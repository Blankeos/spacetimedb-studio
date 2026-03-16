import { spawn } from "node:child_process"

export interface StatementResult {
  statement: string
  success: boolean
  data: {
    rows: Record<string, unknown>[]
    columns: string[]
    numRows: number
  } | null
  error: string | null
}

interface ParsedStatement {
  text: string
  startLine: number
}

function parseSqlStatements(sql: string): ParsedStatement[] {
  const statements: ParsedStatement[] = []
  let current = ""
  let inString = false
  let stringChar = ""
  let i = 0
  let startLine = 1
  let currentLine = 1

  const isCommentStart = (pos: number) => sql[pos] === "-" && sql[pos + 1] === "-"
  const isBlockCommentStart = (pos: number) => sql[pos] === "/" && sql[pos + 1] === "*"
  const isBlockCommentEnd = (pos: number) => sql[pos] === "*" && sql[pos + 1] === "/"

  while (i < sql.length) {
    if (!inString && isCommentStart(i)) {
      while (i < sql.length && sql[i] !== "\n") {
        i++
      }
      continue
    }

    if (!inString && isBlockCommentStart(i)) {
      i += 2
      while (i < sql.length - 1 && !isBlockCommentEnd(i)) {
        if (sql[i] === "\n") currentLine++
        i++
      }
      i += 2
      continue
    }

    const char = sql[i]

    if (!inString && (char === "'" || char === '"')) {
      inString = true
      stringChar = char
      current += char
      i++
      continue
    }

    if (inString && char === stringChar) {
      if (sql[i + 1] === stringChar) {
        current += char + sql[i + 1]
        i += 2
        continue
      }
      inString = false
      current += char
      i++
      continue
    }

    if (char === "\n") {
      currentLine++
    }

    if (!inString && char === ";") {
      const trimmed = current.trim()
      if (trimmed.length > 0) {
        statements.push({
          text: `${trimmed};`,
          startLine,
        })
      }
      current = ""
      startLine = currentLine
      i++
      continue
    }

    current += char
    i++
  }

  const trimmed = current.trim()
  if (trimmed.length > 0) {
    statements.push({
      text: trimmed,
      startLine,
    })
  }

  return statements
}

function parseTableOutput(output: string): { rows: Record<string, unknown>[]; columns: string[] } {
  const lines = output.split("\n").filter((line) => line.trim())

  if (lines.length === 0) {
    return { rows: [], columns: [] }
  }

  const separatorIndex = lines.findIndex((line) => line.includes("---"))

  if (separatorIndex === -1 || separatorIndex === 0) {
    return { rows: [], columns: [] }
  }

  const headerLine = lines[separatorIndex - 1]
  if (!headerLine) {
    return { rows: [], columns: [] }
  }
  const columns = headerLine.split(/\s+/).filter((col) => col.length > 0)

  const rows: Record<string, unknown>[] = []

  for (let i = separatorIndex + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line || line.includes("---")) continue

    const values = line.split(/\s+/).filter((val) => val.length > 0)

    const row: Record<string, unknown> = {}
    columns.forEach((col, idx) => {
      let value: unknown = values[idx] ?? null
      if (typeof value === "string") {
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1)
        } else if (value === "null" || value === "NULL") {
          value = null
        } else if (/^-?\d+$/.test(value)) {
          value = parseInt(value, 10)
        } else if (/^-?\d+\.\d+$/.test(value)) {
          value = parseFloat(value)
        } else if (value === "true" || value === "false") {
          value = value === "true"
        }
      }
      row[col] = value
    })
    rows.push(row)
  }

  return { rows, columns }
}

async function executeSqlRaw(
  database: string,
  sql: string
): Promise<{ rows: Record<string, unknown>[]; columns: string[] }> {
  return new Promise((resolve, reject) => {
    const child = spawn("spacetime", ["sql", database, sql], {
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    child.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    child.on("close", (code) => {
      if (code !== 0) {
        const errorMsg =
          stderr.replace(/^WARNING:.*\n/, "").trim() || `spacetime sql exited with code ${code}`
        reject(new Error(errorMsg))
        return
      }

      resolve(parseTableOutput(stdout.trim()))
    })

    child.on("error", (err) => {
      reject(err)
    })
  })
}

async function executeSingleStatement(
  database: string,
  statement: string
): Promise<StatementResult> {
  try {
    const result = await executeSqlRaw(database, statement)
    return {
      statement,
      success: true,
      data: {
        rows: result.rows,
        columns: result.columns,
        numRows: result.rows.length,
      },
      error: null,
    }
  } catch (err) {
    return {
      statement,
      success: false,
      data: null,
      error: err instanceof Error ? err.message : "Query execution failed",
    }
  }
}

export async function executeMultipleStatements(
  database: string,
  sql: string
): Promise<StatementResult[]> {
  const statements = parseSqlStatements(sql)

  if (statements.length === 0) {
    return [
      {
        statement: "",
        success: false,
        data: null,
        error: "No valid SQL statements found",
      },
    ]
  }

  const results: StatementResult[] = []
  for (const stmt of statements) {
    const result = await executeSingleStatement(database, stmt.text)
    results.push(result)
  }

  return results
}

interface SpacetimeDescribe {
  typespace: {
    types: unknown[]
  }
  tables: Array<{
    name: string
    product_type_ref: number
    primary_key: unknown[]
    indexes: unknown[]
    constraints: unknown[]
    sequences: unknown[]
    schedule: { none: [] } | { some: unknown }
    table_type: { User: [] } | { system: [] }
    table_access: { Public: [] } | { Private: [] }
  }>
  reducers: Array<{
    name: string
    params: { elements: unknown[] }
    lifecycle: { none: [] } | { some: unknown }
  }>
  types: Array<{
    name: { scope: string[]; name: string }
    ty: number
    custom_ordering: boolean
  }>
  misc_exports: unknown[]
  row_level_security: unknown[]
}

export async function describeDatabase(database: string): Promise<SpacetimeDescribe> {
  return new Promise((resolve, reject) => {
    const child = spawn("spacetime", ["describe", database, "--json"], {
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    child.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `spacetime describe exited with code ${code}`))
        return
      }

      try {
        const result = JSON.parse(stdout) as SpacetimeDescribe
        resolve(result)
      } catch {
        reject(new Error("Failed to parse describe output"))
      }
    })

    child.on("error", (err) => {
      reject(err)
    })
  })
}

export interface TableInfo {
  name: string
  rowCount: number | null
  type: "user" | "system"
}

export async function getTablesWithCounts(database: string): Promise<TableInfo[]> {
  const describe = await describeDatabase(database)

  const tables: TableInfo[] = describe.tables.map((table) => ({
    name: table.name,
    rowCount: null,
    type: "table_type" in table && table.table_type && "User" in table.table_type ? "user" : "system",
  }))

  for (const table of tables) {
    try {
      const result = await executeSqlRaw(database, `SELECT COUNT(*) FROM ${table.name};`)
      if (result.rows.length > 0 && result.columns.includes("count(*)")) {
        const countValue = result.rows[0]["count(*)"]
        table.rowCount = typeof countValue === "number" ? countValue : parseInt(String(countValue), 10)
      }
    } catch {
      table.rowCount = null
    }
  }

  return tables
}
