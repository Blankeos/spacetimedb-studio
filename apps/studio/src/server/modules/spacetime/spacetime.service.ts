import { spawn } from "node:child_process"

function transformUuidsToHex(sql: string): string {
  // Match any UUID-shaped string (8-4-4-4-12 alphanumeric pattern) and convert to 0x hex
  // SpacetimeDB only accepts 0x hex format for UUIDs, not quoted strings
  return sql.replace(
    /'([0-9a-zA-Z]{8}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{12})'/g,
    (_, uuid) => {
      const hex = uuid.replace(/-/g, "")
      return `0x${hex}`
    }
  )
}

interface SchemaColumn {
  name: string
  type: string
}

const schemaCache = new Map<string, Map<string, SchemaColumn[]>>()

async function getTableColumns(
  database: string,
  tableName: string
): Promise<SchemaColumn[] | null> {
  const cacheKey = `${database}:${tableName}`
  const cachedColumns = schemaCache.get(database)
  if (cachedColumns) {
    return cachedColumns.get(tableName) ?? null
  }

  try {
    const describe = await describeDatabase(database)
    const columnsByTable = new Map<string, SchemaColumn[]>()

    for (const table of describe.tables) {
      const typeRef = table.product_type_ref
      const typeDef = describe.typespace.types[typeRef]
      if (!typeDef || typeof typeDef !== "object" || !("Product" in typeDef)) continue

      const productType = typeDef as {
        Product: { elements: Array<{ name?: { some?: string }; algebraic_type?: unknown }> }
      }
      const columns: SchemaColumn[] = []

      for (const elem of productType.Product.elements) {
        const name = elem.name?.some ?? "unknown"
        let typeStr = "unknown"
        if (elem.algebraic_type) {
          const at = elem.algebraic_type
          if (typeof at === "object") {
            if ("String" in at) typeStr = "String"
            else if ("U8" in at) typeStr = "U8"
            else if ("U16" in at) typeStr = "U16"
            else if ("U32" in at) typeStr = "U32"
            else if ("U64" in at) typeStr = "U64"
            else if ("U128" in at) typeStr = "U128"
            else if ("I8" in at) typeStr = "I8"
            else if ("I16" in at) typeStr = "I16"
            else if ("I32" in at) typeStr = "I32"
            else if ("I64" in at) typeStr = "I64"
            else if ("I128" in at) typeStr = "I128"
            else if ("Bool" in at) typeStr = "Bool"
            else if ("F32" in at) typeStr = "F32"
            else if ("F64" in at) typeStr = "F64"
            else if ("Product" in at) {
              const prod = at as {
                Product: { elements: Array<{ name?: { some?: string }; algebraic_type?: unknown }> }
              }
              const innerName = prod.Product.elements[0]?.name?.some
              if (innerName === "__uuid__") typeStr = "UUID"
              else if (innerName === "__identity__") typeStr = "Identity"
            }
          }
        }
        columns.push({ name, type: typeStr })
      }
      columnsByTable.set(table.name, columns)
    }

    schemaCache.set(database, columnsByTable)
    return columnsByTable.get(tableName) ?? null
  } catch {
    return null
  }
}

function parseInsertValues(valuesStr: string): string[] {
  const values: string[] = []
  let current = ""
  let depth = 0
  let inString = false
  let stringChar = ""

  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i]

    if (inString) {
      current += char
      if (char === stringChar && valuesStr[i + 1] !== stringChar) {
        inString = false
      } else if (char === stringChar) {
        i++
        current += valuesStr[i]
      }
    } else if (char === "'" || char === '"') {
      inString = true
      stringChar = char
      current += char
    } else if (char === "(") {
      depth++
      current += char
    } else if (char === ")") {
      depth--
      current += char
    } else if (char === "," && depth === 0) {
      values.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }

  if (current.trim()) {
    values.push(current.trim())
  }

  return values
}

function reorderValuesToSchemaOrder(sql: string, schemaColumns: SchemaColumn[]): string {
  const schemaColumnNames = schemaColumns.map((c) => c.name)
  const schemaColumnNamesLower = schemaColumnNames.map((c) => c.toLowerCase())
  const columnListStr = schemaColumnNames.join(", ")

  // Match INSERT with explicit column list
  const withColumnsMatch = sql.match(
    /INSERT\s+INTO\s+([^\s(]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+(?:\([^)]*\)[^)]*)*)\)/i
  )

  if (withColumnsMatch) {
    const [, tableName, columnsStr, valuesStr] = withColumnsMatch
    const specifiedColumns = columnsStr.split(",").map((c) => c.trim().replace(/["`']/g, ""))
    const values = parseInsertValues(valuesStr)

    if (specifiedColumns.length !== values.length) return sql

    const specifiedColumnsLower = specifiedColumns.map((c) => c.toLowerCase())

    // Reorder values to match schema order
    const reorderedValues: string[] = []
    for (const schemaCol of schemaColumnNamesLower) {
      const idx = specifiedColumnsLower.indexOf(schemaCol)
      if (idx !== -1) {
        reorderedValues.push(values[idx])
      }
    }

    if (reorderedValues.length !== values.length) return sql

    const newValuesStr = reorderedValues.join(", ")
    return sql.replace(
      /INSERT\s+INTO\s+([^\s(]+)\s*\([^)]+\)\s*VALUES\s*\([^)]+(?:\([^)]*\)[^)]*)*\)/i,
      `INSERT INTO ${tableName}(${columnListStr}) VALUES (${newValuesStr})`
    )
  }

  // Match INSERT without column list — add column list (SpacetimeDB requires it)
  const withoutColumnsMatch = sql.match(
    /INSERT\s+INTO\s+([^\s(]+)\s*VALUES\s*\(/i
  )

  if (withoutColumnsMatch) {
    const [, tableName] = withoutColumnsMatch
    return sql.replace(
      /INSERT\s+INTO\s+([^\s(]+)\s*VALUES\s*\(/i,
      `INSERT INTO ${tableName}(${columnListStr}) VALUES (`
    )
  }

  return sql
}

async function transformSqlForSpacetimeDb(sql: string, database?: string): Promise<string> {
  let transformed = transformUuidsToHex(sql)

  if (database) {
    const insertMatch = sql.match(/INSERT\s+INTO\s+([^\s(]+)/i)
    if (insertMatch) {
      const tableName = insertMatch[1].replace(/["`']/g, "")
      const columns = await getTableColumns(database, tableName)
      if (columns) {
        transformed = reorderValuesToSchemaOrder(transformed, columns)
      }
    }
  }

  return transformed
}

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

  const separatorIndex = lines.findIndex(
    (line) => /^[+-]+$/.test(line.trim()) || /^\|?[ -]+\|/.test(line)
  )

  if (separatorIndex === -1 || separatorIndex === 0) {
    return { rows: [], columns: [] }
  }

  const headerLine = lines[separatorIndex - 1]
  if (!headerLine) {
    return { rows: [], columns: [] }
  }

  const parseRow = (line: string): string[] => {
    if (line.includes("|")) {
      return line
        .split("|")
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0)
    }
    return line.split(/\s+/).filter((col) => col.length > 0)
  }

  const columns = parseRow(headerLine)

  const rows: Record<string, unknown>[] = []

  for (let i = separatorIndex + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line || /^[ -]+$/.test(line.trim())) continue

    const values = parseRow(line)

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
    const transformedStatement = await transformSqlForSpacetimeDb(statement, database)
    const result = await executeSqlRaw(database, transformedStatement)
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
    type:
      "table_type" in table && table.table_type && "User" in table.table_type ? "user" : "system",
  }))

  for (const table of tables) {
    try {
      const result = await executeSqlRaw(database, `SELECT COUNT(*) AS count FROM ${table.name};`)
      if (result.rows.length > 0 && result.columns.length > 0) {
        const firstCol = result.columns[0]
        const countValue = result.rows[0][firstCol]
        const parsed = typeof countValue === "number" ? countValue : parseInt(String(countValue), 10)
        table.rowCount = isNaN(parsed) ? null : parsed
      }
    } catch {
      table.rowCount = null
    }
  }

  return tables
}
