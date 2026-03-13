import { spawn } from "child_process"

function stripSqlComments(sql: string): string {
  return sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .trim()
}

function parseTableOutput(output: string): { rows: Record<string, unknown>[]; columns: string[] } {
  const lines = output.split('\n').filter(line => line.trim())
  
  if (lines.length === 0) {
    return { rows: [], columns: [] }
  }
  
  const separatorIndex = lines.findIndex(line => line.includes('---'))
  
  if (separatorIndex === -1 || separatorIndex === 0) {
    return { rows: [], columns: [] }
  }
  
  const headerLine = lines[separatorIndex - 1]
  if (!headerLine) {
    return { rows: [], columns: [] }
  }
  const columns = headerLine.split(/\s+/).filter(col => col.length > 0)
  
  const rows: Record<string, unknown>[] = []
  
  for (let i = separatorIndex + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line || line.includes('---')) continue
    
    const values = line.split(/\s+/).filter(val => val.length > 0)
    
    const row: Record<string, unknown> = {}
    columns.forEach((col, idx) => {
      let value: unknown = values[idx] ?? null
      if (typeof value === 'string') {
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1)
        } else if (value === 'null' || value === 'NULL') {
          value = null
        } else if (/^-?\d+$/.test(value)) {
          value = parseInt(value, 10)
        } else if (/^-?\d+\.\d+$/.test(value)) {
          value = parseFloat(value)
        } else if (value === 'true' || value === 'false') {
          value = value === 'true'
        }
      }
      row[col] = value
    })
    rows.push(row)
  }
  
  return { rows, columns }
}

export async function executeSql(database: string, sql: string): Promise<{ rows: Record<string, unknown>[]; columns: string[] }> {
  return new Promise((resolve, reject) => {
    const cleanSql = stripSqlComments(sql)
    
    if (!cleanSql) {
      reject(new Error("Empty query after removing comments"))
      return
    }
    
    const child = spawn("spacetime", ["sql", database, cleanSql], {
      stdio: ["ignore", "pipe", "pipe"]
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
        const errorMsg = stderr.replace(/^WARNING:.*\n/, '').trim() || `spacetime sql exited with code ${code}`
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
    name: { scope: string[], name: string }
    ty: number
    custom_ordering: boolean
  }>
  misc_exports: unknown[]
  row_level_security: unknown[]
}

export async function describeDatabase(database: string): Promise<SpacetimeDescribe> {
  return new Promise((resolve, reject) => {
    const child = spawn("spacetime", ["describe", database, "--json"], {
      stdio: ["ignore", "pipe", "pipe"]
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