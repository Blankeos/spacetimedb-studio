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
function convertAlgebraicType(t: any, typespace: any[], typeRef: any): any {
  if (typeRef.String !== undefined) return t.string()
  if (typeRef.Bytes !== undefined) return t.bytes()
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
  if (typeRef.Duration !== undefined) return t.duration()

  if (typeRef.Option !== undefined) {
    return t.option(convertAlgebraicType(t, typespace, typeRef.Option.some))
  }
  if (typeRef.Array !== undefined) {
    return t.array(convertAlgebraicType(t, typespace, typeRef.Array.element))
  }
  if (typeRef.Product !== undefined) {
    const fields: Record<string, unknown> = {}
    for (const elem of typeRef.Product.elements) {
      const fieldName = elem.name?.some
      if (fieldName) {
        fields[fieldName] = convertAlgebraicType(t, typespace, elem.algebraic_type)
      }
    }
    return t.object(undefined, fields)
  }
  if (typeRef.Sum !== undefined) {
    const variants: Record<string, unknown> = {}
    for (const variant of typeRef.Sum.variants) {
      const variantName = variant.name?.some
      if (variantName) {
        variants[variantName] = convertAlgebraicType(t, typespace, variant.algebraic_type)
      }
    }
    return t.enum(undefined, variants)
  }
  if (typeRef.Ref !== undefined) {
    const refType = typespace[typeRef.Ref]
    if (refType) {
      return convertAlgebraicType(t, typespace, refType)
    }
  }
  // Fallback
  return t.bytes()
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
      for (const elem of typeDef.Product.elements) {
        const fieldName = elem.name?.some
        if (fieldName) {
          fields[fieldName] = convertAlgebraicType(t, typespace, elem.algebraic_type)
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

  // Build reducer definitions - pass plain object, not t.object()
  const reducerDefs: unknown[] = []
  for (const reducer of schema.reducers || []) {
    const params: Record<string, unknown> = {}
    if (reducer.params?.elements) {
      for (const elem of reducer.params.elements) {
        const paramName = elem.name?.some
        if (paramName) {
          params[paramName] = convertAlgebraicType(t, typespace, elem.algebraic_type)
        }
      }
    }
    reducerDefs.push(reducerSchema(reducer.name, params))
  }

  const tablesSchema = schemaFn(tables)
  const reducersSchema = reducers(...reducerDefs)

  console.log("[Spacetime] Built schema with tables:", Object.keys(tables))

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
    console.log("[Spacetime] Provider cleanup - disconnecting")
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
    // Prevent re-entrancy and re-connecting to same database
    if (isConnecting || (currentDatabase === database && globalConnection())) {
      console.log("[Spacetime] Skipping connect - already connecting or connected to", database)
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
      console.log("[Spacetime] Connecting to:", database)
      const [config, sdk, dbSchema] = await Promise.all([
        fetchConnectionConfig(database),
        getSdkModules(),
        fetchDatabaseSchema(database),
      ])

      console.log("[Spacetime] Config:", config)
      console.log(
        "[Spacetime] Schema tables:",
        (dbSchema.tables || []).map((t: any) => t.name).join(", ")
      )

      // Build remote module from actual schema
      const remoteModule = await buildRemoteModule(dbSchema)
      console.log("[Spacetime] Remote module built")

      // Create DbConnection class
      const DynamicDbConnection = class extends (sdk.DbConnectionImpl as any) {
        constructor(config: unknown) {
          super(config)
        }
      }

      // Create connection builder
      const builder = new (sdk.DbConnectionBuilder as any)(
        remoteModule,
        (config: unknown) => new DynamicDbConnection(config)
      )
        .withUri(config.uri)
        .withDatabaseName(config.database)
        .onConnect((conn: unknown, _identity: unknown, _token: unknown) => {
          console.log("[Spacetime] Connected!")
          isConnecting = false
          currentDatabase = database
          // Log available tables
          if (conn && typeof conn === "object" && "db" in conn) {
            const dbConn = conn as { db: Record<string, unknown> }
            console.log("[Spacetime] Available tables:", Object.keys(dbConn.db))
          }
          setGlobalConnection(conn)
          setGlobalIsActive(true)
          setGlobalConnectionError(null)
        })
        .onDisconnect((ctx: unknown, error?: Error) => {
          console.log("[Spacetime] Disconnected", error)
          isConnecting = false
          currentDatabase = null
          setGlobalConnection(null)
          setGlobalIsActive(false)
        })
        .onConnectError((_ctx: unknown, error: Error) => {
          console.error("[Spacetime] Connection error:", error)
          isConnecting = false
          currentDatabase = null
          setGlobalConnectionError(error.message)
          setGlobalConnection(null)
          setGlobalIsActive(false)
        })

      if (config.token) {
        console.log("[Spacetime] Using auth token")
        builder.withToken(config.token)
      }

      console.log("[Spacetime] Building connection...")
      builder.build()
    } catch (err) {
      console.error("[Spacetime] Failed to connect:", err)
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
    // Cleanup existing subscription for this table
    const existingCleanup = activeSubscriptions.get(tableName)
    if (existingCleanup) {
      console.log("[Spacetime] Cleaning up existing subscription for:", tableName)
      existingCleanup()
    }

    const conn = globalConnection()
    if (!conn) {
      console.log("[Spacetime] subscribeToTable: no connection")
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
    console.log("[Spacetime] subscribeToTable:", tableName)
    console.log("[Spacetime] Available tables:", Object.keys(dbConn.db))

    const cleanupFns: (() => void)[] = []

    // Get table API and register handlers
    const table = dbConn.db[tableName] as TableAPI | undefined
    console.log("[Spacetime] Table object:", table ? "exists" : "not found")

    if (table) {
      // Register event handlers for real-time updates
      const unsubInsert = table.onInsert((_ctx: unknown, row: TableRow) => {
        console.log("[Spacetime] onInsert:", row)
        callbacks.onInsert?.(row)
      })
      cleanupFns.push(unsubInsert)

      const unsubDelete = table.onDelete((_ctx: unknown, row: TableRow) => {
        console.log("[Spacetime] onDelete:", row)
        callbacks.onDelete?.(row)
      })
      cleanupFns.push(unsubDelete)

      const unsubUpdate = table.onUpdate((_ctx: unknown, oldRow: TableRow, newRow: TableRow) => {
        console.log("[Spacetime] onUpdate:", oldRow, "->", newRow)
        callbacks.onUpdate?.(oldRow, newRow)
      })
      cleanupFns.push(unsubUpdate)
    }

    // Subscribe and get initial data
    const subHandle = dbConn
      .subscriptionBuilder()
      .onApplied(() => {
        console.log("[Spacetime] Subscription applied for:", tableName)

        const tableAfter = dbConn.db[tableName] as TableAPI | undefined

        if (tableAfter) {
          try {
            const rows = Array.from(tableAfter.iter()) as TableRow[]
            console.log("[Spacetime] Got", rows.length, "rows")
            callbacks.onApplied?.(rows)
          } catch (e) {
            console.error("[Spacetime] Error iterating rows:", e)
            callbacks.onApplied?.([])
          }
        } else {
          console.log("[Spacetime] Table not found after subscription")
          callbacks.onApplied?.([])
        }
      })
      .subscribe(`SELECT * FROM ${tableName}`)

    const cleanup = () => {
      console.log("[Spacetime] Unsubscribing from:", tableName)
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
