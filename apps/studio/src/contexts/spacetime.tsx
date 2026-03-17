import { createContext, createSignal, type JSX, onCleanup, useContext } from "solid-js"
import { honoClient } from "@/lib/hono-client"

export interface TableRow {
  [key: string]: unknown
}

export interface SpacetimeContextValue {
  connection: () => unknown | null
  isConnected: () => boolean
  connectionError: () => string | null
  connect: (database: string) => Promise<void>
  disconnect: () => void
  subscribeToTable: (
    tableName: string,
    callbacks: {
      onApplied?: (rows: TableRow[]) => void
      onInsert?: (row: TableRow) => void
      onDelete?: (row: TableRow) => void
      onUpdate?: (oldRow: TableRow, newRow: TableRow) => void
    }
  ) => () => void
  getConnectionState: () => "connecting" | "connected" | "disconnected" | "error"
}

interface ConnectionConfig {
  uri: string
  database: string
  token: string | null
}

const SpacetimeContext = createContext<SpacetimeContextValue>()

async function fetchConnectionConfig(database: string): Promise<ConnectionConfig> {
  const res = await honoClient.spacetime.connection[":database"].$get({
    param: { database },
  })
  const data = await res.json()

  if (!data.success || !data.data) {
    throw new Error(data.error || "Failed to get connection config")
  }

  return data.data as ConnectionConfig
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchDatabaseSchema(database: string): Promise<any> {
  const res = await honoClient.spacetime.schema[":database"].$get({
    param: { database },
  })
  const data = await res.json()

  if (!data.success || !data.data) {
    throw new Error(data.error || "Failed to get schema")
  }

  return data.data
}

// Lazy load the SDK
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sdkModules: any = null

async function getSdkModules() {
  if (!sdkModules) {
    const sdk = await import("spacetimedb/sdk")
    sdkModules = {
      DbConnectionBuilder: sdk.DbConnectionBuilder,
      DbConnectionImpl: sdk.DbConnectionImpl,
      t: sdk.t,
      table: sdk.table,
      schema: sdk.schema,
      reducers: sdk.reducers,
      procedures: sdk.procedures,
      reducerSchema: sdk.reducerSchema,
    }
  }
  return sdkModules
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convertAlgebraicType(t: any, typespace: any[], typeRef: any, fieldName?: string): any {
  try {
    if (!typeRef || typeof typeRef !== "object") {
      console.warn("[Spacetime] Invalid typeRef for field:", fieldName, typeRef)
      return t.byteArray()
    }

    if (typeRef.String !== undefined) return t.string()
    if (typeRef.Bytes !== undefined) return t.byteArray()
    if (typeRef.U8 !== undefined) return t.u8()
    if (typeRef.U16 !== undefined) return t.u16()
    if (typeRef.U32 !== undefined) return t.u32()
    if (typeRef.U64 !== undefined) return t.u64()
    if (typeRef.U128 !== undefined) return t.u128()
    if (typeRef.U256 !== undefined) return t.u256()
    if (typeRef.I8 !== undefined) return t.i8()
    if (typeRef.I16 !== undefined) return t.i16()
    if (typeRef.I32 !== undefined) return t.i32()
    if (typeRef.I64 !== undefined) return t.i64()
    if (typeRef.I128 !== undefined) return t.i128()
    if (typeRef.I256 !== undefined) return t.i256()
    if (typeRef.F32 !== undefined) return t.f32()
    if (typeRef.F64 !== undefined) return t.f64()
    if (typeRef.Bool !== undefined) return t.bool()
    if (typeRef.Identity !== undefined) return t.identity()
    if (typeRef.Timestamp !== undefined) return t.timestamp()
    if (typeRef.Duration !== undefined) return t.timeDuration()
    if (typeRef.Ref !== undefined) {
      const refType = typespace[typeRef.Ref]
      if (refType) {
        if (refType.Product) {
          const elements = refType.Product?.elements || []
          if (elements.length === 1) {
            const elem = elements[0]
            const name = elem.name?.some ?? elem.name
            if (name === "__uuid__") {
              return t.uuid()
            }
          }
        }
        return convertAlgebraicType(t, typespace, refType, fieldName)
      }
    }

    if (typeRef.Option !== undefined && typeRef.Option !== null) {
      const someType = typeRef.Option?.some
      if (someType !== undefined && someType !== null) {
        return t.option(convertAlgebraicType(t, typespace, someType, fieldName))
      }
    }
    if (typeRef.Array !== undefined && typeRef.Array !== null) {
      const elemType = typeRef.Array?.element
      if (elemType !== undefined && elemType !== null) {
        return t.array(convertAlgebraicType(t, typespace, elemType, fieldName))
      }
    }
    if (typeRef.Product !== undefined && typeRef.Product !== null) {
      const elements = typeRef.Product?.elements || []
      // Check if this is a UUID wrapper: single element named __uuid__
      if (elements.length === 1) {
        const elem = elements[0]
        const name = elem.name?.some ?? elem.name
        if (name === "__uuid__") {
          return t.uuid()
        }
      }
      const fields: Record<string, unknown> = {}
      for (const elem of elements) {
        const innerFieldName = elem.name?.some ?? elem.name
        if (innerFieldName) {
          fields[innerFieldName] = convertAlgebraicType(
            t,
            typespace,
            elem.algebraic_type,
            innerFieldName
          )
        }
      }
      return t.object(undefined, fields)
    }
    if (typeRef.Sum !== undefined && typeRef.Sum !== null) {
      const variants: Record<string, unknown> = {}
      const variantsArr = typeRef.Sum?.variants || []
      for (const variant of variantsArr) {
        const variantName = variant.name?.some ?? variant.name
        if (variantName) {
          variants[variantName] = convertAlgebraicType(
            t,
            typespace,
            variant.algebraic_type,
            variantName
          )
        }
      }
      return t.enum(undefined, variants)
    }
  } catch (err) {
    console.warn("[Spacetime] Error converting type for field:", fieldName, err)
  }
  return t.byteArray()
}

// Build remote module from database schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildRemoteModule(schema: any) {
  const { t, table, schema: schemaFn, reducers, procedures, reducerSchema } = await getSdkModules()

  const typespace = schema.typespace?.types || []

  // Build table definitions - must use table() wrapper with t.row()
  const tables: Record<string, unknown> = {}
  for (const tableInfo of schema.tables || []) {
    const typeIdx = tableInfo.product_type_ref
    const typeDef = typespace[typeIdx]

    if (typeDef && typeDef.Product) {
      const fields: Record<string, unknown> = {}
      const elements = typeDef.Product?.elements || []
      for (const elem of elements) {
        const fName = elem.name?.some ?? elem.name
        if (fName) {
          fields[fName] = convertAlgebraicType(t, typespace, elem.algebraic_type, fName)
        }
      }
      const rowType = t.row(fields)
      tables[tableInfo.name] = table(
        {
          name: tableInfo.name,
          indexes: [],
          constraints: [],
        },
        rowType
      )
    }
  }

  const reducerDefs: unknown[] = []
  for (const reducer of schema.reducers || []) {
    const params: Record<string, unknown> = {}
    const elements = reducer.params?.elements || []
    for (const elem of elements) {
      const paramName = elem.name?.some ?? elem.name
      if (paramName) {
        params[paramName] = convertAlgebraicType(t, typespace, elem.algebraic_type, paramName)
      }
    }
    reducerDefs.push(reducerSchema(reducer.name, params))
  }

  const tablesSchema = schemaFn(tables)
  const reducersSchema = reducers(...reducerDefs)

  return {
    versionInfo: {
      cliVersion: "2.0.4" as const,
    },
    tables: tablesSchema.schemaType.tables,
    reducers: reducersSchema.reducersType.reducers,
    ...procedures(),
  }
}

// Global connection state
const [globalConnection, setGlobalConnection] = createSignal<unknown>(null)
const [globalIsActive, setGlobalIsActive] = createSignal(false)
const [globalConnectionError, setGlobalConnectionError] = createSignal<string | null>(null)
let isConnecting = false
let currentDatabase: string | null = null

// Track active subscriptions per table
const activeSubscriptions = new Map<string, () => void>()

export function SpacetimeProvider(props: { children: JSX.Element }) {
  onCleanup(() => {
    activeSubscriptions.clear()
    const conn = globalConnection()
    if (conn && typeof conn === "object" && "disconnect" in conn) {
      try {
        ;(conn as { disconnect: () => void }).disconnect()
      } catch {
        // ignore
      }
    }
    setGlobalConnection(null)
    setGlobalIsActive(false)
    setGlobalConnectionError(null)
    currentDatabase = null
  })

  const connect = async (database: string) => {
    if (isConnecting || (currentDatabase === database && globalConnection())) {
      return
    }
    isConnecting = true

    // Disconnect existing connection
    const existingConn = globalConnection()
    if (existingConn && typeof existingConn === "object" && "disconnect" in existingConn) {
      try {
        ;(existingConn as { disconnect: () => void }).disconnect()
      } catch {
        // ignore
      }
    }
    activeSubscriptions.clear()
    setGlobalConnection(null)
    setGlobalIsActive(false)
    setGlobalConnectionError(null)

    try {
      const [config, sdk, dbSchema] = await Promise.all([
        fetchConnectionConfig(database),
        getSdkModules(),
        fetchDatabaseSchema(database),
      ])

      // Build remote module from actual schema
      const remoteModule = await buildRemoteModule(dbSchema)

      // DbConnectionBuilder calls dbConnectionCtor(config) without 'new',
      // but DbConnectionImpl is a class that requires 'new'.
      // So we wrap it in a factory function.
      const createConnection = (config: unknown) => new (sdk.DbConnectionImpl as any)(config)

      const builder = new (sdk.DbConnectionBuilder as any)(remoteModule, createConnection)
        .withUri(config.uri)
        .withDatabaseName(config.database)
        .onConnect((conn: unknown, _identity: unknown, _token: unknown) => {
          isConnecting = false
          currentDatabase = database
          setGlobalConnection(conn)
          setGlobalIsActive(true)
          setGlobalConnectionError(null)
        })
        .onDisconnect((_ctx: unknown, _error?: Error) => {
          isConnecting = false
          currentDatabase = null
          setGlobalConnection(null)
          setGlobalIsActive(false)
        })
        .onConnectError((_ctx: unknown, error: Error) => {
          isConnecting = false
          currentDatabase = null
          setGlobalConnectionError(error.message)
          setGlobalConnection(null)
          setGlobalIsActive(false)
        })

      if (config.token) {
        builder.withToken(config.token)
      }

      builder.build()
    } catch (err) {
      isConnecting = false
      currentDatabase = null
      const message = err instanceof Error ? err.message : "Failed to connect"
      setGlobalConnectionError(message)
      setGlobalConnection(null)
      setGlobalIsActive(false)
    }
  }

  const disconnect = () => {
    activeSubscriptions.clear()
    const conn = globalConnection()
    if (conn && typeof conn === "object" && "disconnect" in conn) {
      try {
        ;(conn as { disconnect: () => void }).disconnect()
      } catch {
        // ignore
      }
    }
    setGlobalConnection(null)
    setGlobalIsActive(false)
    setGlobalConnectionError(null)
    currentDatabase = null
  }

  const subscribeToTable = (
    tableName: string,
    callbacks: {
      onApplied?: (rows: TableRow[]) => void
      onInsert?: (row: TableRow) => void
      onDelete?: (row: TableRow) => void
      onUpdate?: (oldRow: TableRow, newRow: TableRow) => void
    }
  ): (() => void) => {
    const existingCleanup = activeSubscriptions.get(tableName)
    if (existingCleanup) {
      existingCleanup()
    }

    const conn = globalConnection()
    if (!conn) {
      callbacks.onApplied?.([])
      return () => {}
    }

    type DbConnection = {
      subscriptionBuilder: () => {
        onApplied: (cb: () => void) => { subscribe: (query: string) => { unsubscribe: () => void } }
        subscribe: (query: string) => { unsubscribe: () => void }
      }
      db: Record<string, unknown>
    }

    type TableAPI = {
      iter: () => IterableIterator<TableRow>
      onInsert: (cb: (ctx: unknown, row: TableRow) => void) => () => void
      onDelete: (cb: (ctx: unknown, row: TableRow) => void) => () => void
      onUpdate: (cb: (ctx: unknown, oldRow: TableRow, newRow: TableRow) => void) => () => void
    }

    const dbConn = conn as DbConnection

    const cleanupFns: (() => void)[] = []

    const table = dbConn.db[tableName] as TableAPI | undefined

    if (table) {
      const unsubInsert = table.onInsert((_ctx: unknown, row: TableRow) => {
        callbacks.onInsert?.(row)
      })
      cleanupFns.push(unsubInsert)

      const unsubDelete = table.onDelete((_ctx: unknown, row: TableRow) => {
        callbacks.onDelete?.(row)
      })
      cleanupFns.push(unsubDelete)

      const unsubUpdate = table.onUpdate((_ctx: unknown, oldRow: TableRow, newRow: TableRow) => {
        callbacks.onUpdate?.(oldRow, newRow)
      })
      cleanupFns.push(unsubUpdate)
    }

    const subHandle = dbConn
      .subscriptionBuilder()
      .onApplied(() => {
        const tableAfter = dbConn.db[tableName] as TableAPI | undefined

        if (tableAfter) {
          try {
            const rows = Array.from(tableAfter.iter()) as TableRow[]
            callbacks.onApplied?.(rows)
          } catch {
            callbacks.onApplied?.([])
          }
        } else {
          callbacks.onApplied?.([])
        }
      })
      .subscribe(`SELECT * FROM ${tableName}`)

    const cleanup = () => {
      try {
        subHandle.unsubscribe()
      } catch {
        // ignore
      }
      for (const fn of cleanupFns) {
        try {
          fn()
        } catch {
          // ignore
        }
      }
      activeSubscriptions.delete(tableName)
    }

    activeSubscriptions.set(tableName, cleanup)
    return cleanup
  }

  const getConnectionState = () => {
    const error = globalConnectionError()
    const active = globalIsActive()
    const conn = globalConnection()
    if (error) return "error"
    if (active) return "connected"
    if (conn || isConnecting) return "connecting"
    return "disconnected"
  }

  const value: SpacetimeContextValue = {
    connection: globalConnection,
    isConnected: globalIsActive,
    connectionError: globalConnectionError,
    connect,
    disconnect,
    subscribeToTable,
    getConnectionState,
  }

  return <SpacetimeContext.Provider value={value}>{props.children}</SpacetimeContext.Provider>
}

export function useSpacetime() {
  const ctx = useContext(SpacetimeContext)
  if (!ctx) throw new Error("useSpacetime must be used within SpacetimeProvider")
  return ctx
}
