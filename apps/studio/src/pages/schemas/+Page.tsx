import { createEffect, createMemo, createSignal, For, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useDatabase } from "@/contexts/database"
import { FileJsonIcon, RefreshCwIcon } from "@/icons/sidebar-icons"
import { honoClient } from "@/lib/hono-client"
import type { SpacetimeDescribe } from "@/lib/schema-formatter"
import { createFlow, type EdgeBase, type NodeBase } from "@/lib/solid-flow"
import getTitle from "@/utils/get-title"

interface SchemaNode extends NodeBase {
  type: "table"
  data: {
    name: string
    columns: Array<{ name: string; type: string; primary?: boolean }>
  }
}

interface SchemaEdge extends EdgeBase {
  type: "reference"
  sourceColumn?: string
  targetColumn?: string
}

const SchemaFlow = createFlow<SchemaNode, SchemaEdge>()

const CopyIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
)

const CheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

function schemaToGraph(describe: SpacetimeDescribe): { nodes: SchemaNode[]; edges: SchemaEdge[] } {
  const nodes: SchemaNode[] = []
  const edges: SchemaEdge[] = []

  // Map from table name → primary key column name
  const tablePKs = new Map<string, string>()

  describe.tables.forEach((table) => {
    if (!("User" in table.table_type)) return

    const typeDef = describe.typespace.types[table.product_type_ref]
    const columns: Array<{ name: string; type: string; primary?: boolean }> = []

    if (typeDef && "Product" in typeDef) {
      // primary_key is an array of column indices (e.g. [0])
      const pkIndices = (table.primary_key as unknown as number[]) || []
      const pkColumnNames = new Set(
        pkIndices
          .map((idx) => typeDef.Product.elements[idx]?.name?.some)
          .filter(Boolean) as string[]
      )

      for (const el of typeDef.Product.elements) {
        const name = el.name?.some || "_"
        const typeName = getTypeNameSimple(
          el.algebraic_type,
          describe.types,
          describe.typespace.types
        )
        columns.push({ name, type: typeName, primary: pkColumnNames.has(name) })
      }

      // Store the first PK column for FK detection
      const firstPK = pkIndices[0] !== undefined ? typeDef.Product.elements[pkIndices[0]]?.name?.some : undefined
      if (firstPK) tablePKs.set(table.name, firstPK)
    }

    nodes.push({
      id: `table-${table.name}`,
      type: "table",
      position: { x: 0, y: 0 },
      data: { name: table.name, columns },
    })
  })

  // Detect FK relationships: column named `{tableName}_id` → references `{tableName}.pk`
  for (const node of nodes) {
    const tableName = node.data.name as string
    const columns = node.data.columns as Array<{ name: string; primary?: boolean }>
    for (const col of columns) {
      if (col.primary) continue
      if (!col.name.endsWith("_id")) continue
      const referencedTable = col.name.slice(0, -3) // strip "_id"
      const sourceNodeId = `table-${referencedTable}`
      const sourceNode = nodes.find((n) => n.id === sourceNodeId)
      if (!sourceNode) continue
      const pkCol = tablePKs.get(referencedTable)
      edges.push({
        id: `fk-${referencedTable}-${tableName}-${col.name}`,
        source: sourceNodeId,
        target: node.id,
        type: "reference",
        sourceColumn: pkCol,
        targetColumn: col.name,
      })
    }
  }

  return { nodes, edges }
}

function extractReducers(describe: SpacetimeDescribe) {
  return describe.reducers.map((reducer) => {
    const params: Array<{ name: string; type: string }> = []
    for (const el of reducer.params.elements) {
      const name = el.name?.some || "_"
      const typeName = getTypeNameSimple(
        el.algebraic_type,
        describe.types,
        describe.typespace.types
      )
      params.push({ name, type: typeName })
    }

    let lifecycle: string | undefined
    if ("some" in reducer.lifecycle) {
      const lc = reducer.lifecycle.some
      if ("Init" in lc) lifecycle = "Init"
      else if ("OnConnect" in lc) lifecycle = "OnConnect"
      else if ("OnDisconnect" in lc) lifecycle = "OnDisconnect"
    }

    return {
      name: reducer.name,
      params,
      lifecycle,
    }
  })
}

function getTypeNameSimple(
  ty: unknown,
  types: SpacetimeDescribe["types"],
  typespaceTypes: SpacetimeDescribe["typespace"]["types"]
): string {
  if (typeof ty !== "object" || ty === null) return "unknown"
  const t = ty as Record<string, unknown>

  if ("String" in t) return "string"
  if ("I8" in t) return "i8"
  if ("U8" in t) return "u8"
  if ("I16" in t) return "i16"
  if ("U16" in t) return "u16"
  if ("I32" in t) return "i32"
  if ("U32" in t) return "u32"
  if ("I64" in t) return "i64"
  if ("U64" in t) return "u64"
  if ("I128" in t) return "i128"
  if ("U128" in t) return "u128"
  if ("F32" in t) return "f32"
  if ("F64" in t) return "f64"
  if ("Bool" in t) return "bool"
  if ("Bytes" in t) return "bytes"
  if ("Identity" in t) return "Identity"
  if ("Address" in t) return "Address"
  if ("Timestamp" in t) return "Timestamp"
  if ("Duration" in t) return "Duration"
  if ("Array" in t) {
    const inner = getTypeNameSimple((t as { Array: [unknown] }).Array[0], types, typespaceTypes)
    return `${inner}[]`
  }
  if ("Option" in t) {
    const inner = getTypeNameSimple((t as { Option: [unknown] }).Option[0], types, typespaceTypes)
    return `${inner}?`
  }
  if ("Product" in t) {
    const product = (t as { Product: { elements: Array<{ name?: { some: string } }> } }).Product
    const elem = product.elements?.[0]
    if (elem?.name?.some === "__uuid__") {
      return "uuid"
    }
  }
  if ("Ref" in t) {
    const refId = (t as { Ref: [number] }).Ref[0]
    const typeInfo = types.find((ti) => ti.ty === refId)
    if (typeInfo?.name.name) return typeInfo.name.name
    const typeDef = typespaceTypes[refId]
    if (typeDef && "Product" in typeDef) {
      const elem = typeDef.Product.elements?.[0]
      if (elem?.name?.some === "__uuid__") {
        return "uuid"
      }
    }
    return `Ref<${refId}>`
  }
  return "unknown"
}

export default function SchemasPage() {
  useMetadata({
    title: getTitle("Schemas"),
    description: "SpacetimeDB Studio - View database schema definitions",
  })

  const { database, setDatabase, loading } = useDatabase()
  const [schema, setSchema] = createSignal<SpacetimeDescribe | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [copied, setCopied] = createSignal(false)
  const [view, setView] = createSignal<"graph" | "json">("graph")
  const [refreshing, setRefreshing] = createSignal(false)
  const [selectedReducer, setSelectedReducer] = createSignal<string | null>(null)
  const [reducersOpen, setReducersOpen] = createSignal(true)

  const fetchSchema = async () => {
    const db = database()
    if (!db) return

    setRefreshing(true)
    setError(null)

    try {
      const res = await honoClient.spacetime.describe.$get({ query: { db } })
      const data = await res.json()
      if (data.success && data.data) {
        setSchema(data.data as unknown as SpacetimeDescribe)
      } else {
        setError("Failed to load schema")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schema")
    } finally {
      setRefreshing(false)
    }
  }

  createEffect(() => {
    if (database()) {
      fetchSchema()
    }
  })

  const graphData = createMemo(() => {
    const s = schema()
    if (!s) return { nodes: [], edges: [] }
    return schemaToGraph(s)
  })

  const reducers = createMemo(() => {
    const s = schema()
    if (!s) return []
    return extractReducers(s)
  })

  const schemaJson = () => {
    const s = schema()
    if (!s) return ""
    return JSON.stringify(s, null, 2)
  }

  const handleCopy = async () => {
    const text = schemaJson()
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRefresh = () => {
    fetchSchema()
  }

  const handleDatabaseChange = (db: string) => {
    setDatabase(db)
    setSchema(null)
    const url = new URL(window.location.href)
    url.searchParams.set("db", db)
    window.history.replaceState({}, "", url)
  }

  const userReducers = () => reducers().filter((r) => !r.lifecycle)
  const lifecycleReducers = () => reducers().filter((r) => r.lifecycle)

  const tableCount = () => schema()?.tables.filter((t) => "User" in t.table_type).length || 0

  const selectedReducerData = createMemo(() => {
    const name = selectedReducer()
    if (!name) return null
    return reducers().find((r) => r.name === name)
  })

  return (
    <div class="schemas-page flex h-full flex-col overflow-hidden bg-background">
      <PageHeader
        title="Schemas"
        database={database()}
        loading={loading()}
        onDatabaseChange={handleDatabaseChange}
      >
        <Show when={schema()}>
          <div class="mr-4 hidden items-center gap-3 text-muted-foreground text-xs sm:flex">
            <span>{tableCount()} tables</span>
            <span>{reducers().length} reducers</span>
          </div>
          <Tabs value={view()} onChange={(v) => setView(v as "graph" | "json")} class="mr-2">
            <TabsList class="h-7">
              <TabsTrigger value="graph" class="px-3 py-1 text-xs">
                Graph
              </TabsTrigger>
              <TabsTrigger value="json" class="px-3 py-1 text-xs">
                JSON
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing()}>
            <RefreshCwIcon class={`mr-1 size-3 ${refreshing() ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied() ? <CheckIcon /> : <CopyIcon />}
            <span class="ml-1">{copied() ? "Copied" : "Copy JSON"}</span>
          </Button>
        </Show>
      </PageHeader>

      <main class="flex min-h-0 flex-1 overflow-hidden">
        <Show when={error()}>
          <div class="m-4 rounded-md border border-red-500/50 bg-red-500/10 p-4">
            <p class="text-red-400 text-sm">{error()}</p>
          </div>
        </Show>

        <Show when={loading() && !schema()}>
          <div class="flex flex-1 items-center justify-center">
            <Card>
              <CardContent class="py-8">
                <div class="text-center">
                  <FileJsonIcon class="mx-auto mb-4 size-12 text-muted-foreground/50" />
                  <p class="text-muted-foreground text-sm">Loading schema...</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </Show>

        <Show when={!database() && !loading()}>
          <div class="flex flex-1 items-center justify-center">
            <Card>
              <CardContent class="py-8">
                <div class="text-center">
                  <FileJsonIcon class="mx-auto mb-4 size-12 text-muted-foreground/50" />
                  <h2 class="mb-2 font-medium text-lg">No database selected</h2>
                  <p class="text-muted-foreground text-sm">
                    Click the database indicator above to set a database
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </Show>

        <Show when={schema()}>
          <div class="flex min-w-0 flex-1 overflow-hidden">
            <Show when={view() === "graph"}>
              <div class="relative min-w-0 flex-1">
                <SchemaFlow nodes={graphData().nodes} edges={graphData().edges} fitView={true} />
                <Show when={!reducersOpen()}>
                  <button
                    type="button"
                    class="absolute top-3 right-3 flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow-md transition-colors hover:bg-accent"
                    onClick={() => setReducersOpen(true)}
                    title="Show reducers panel"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect width="18" height="18" x="3" y="3" rx="2" />
                      <path d="M15 3v18" />
                    </svg>
                    Reducers
                  </button>
                </Show>
              </div>

              <Show when={reducersOpen()}>
              <div class="w-64 shrink-0 overflow-y-auto border-border border-l bg-card lg:w-72">
                <div class="flex items-center justify-between border-border border-b p-3">
                  <div>
                    <h3 class="font-semibold text-sm">Reducers</h3>
                    <p class="mt-0.5 text-muted-foreground text-xs">{reducers().length} total</p>
                  </div>
                  <button
                    type="button"
                    class="-mr-1 rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    onClick={() => setReducersOpen(false)}
                    title="Collapse reducers panel"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                </div>

                <Show when={userReducers().length > 0}>
                  <div class="border-border border-b p-3">
                    <div class="mb-2 text-[10px] text-muted-foreground uppercase tracking-wider">
                      User Defined
                    </div>
                    <div class="space-y-1">
                      <For each={userReducers()}>
                        {(reducer) => (
                          <button
                            type="button"
                            class="w-full rounded p-2 text-left transition-colors hover:bg-accent"
                            onClick={() => setSelectedReducer(reducer.name)}
                          >
                            <div class="font-mono text-foreground text-xs">{reducer.name}</div>
                            <div class="mt-0.5 text-[10px] text-muted-foreground">
                              {reducer.params.length} parameter
                              {reducer.params.length !== 1 ? "s" : ""}
                            </div>
                          </button>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>

                <Show when={lifecycleReducers().length > 0}>
                  <div class="p-3">
                    <div class="mb-2 text-[10px] text-muted-foreground uppercase tracking-wider">
                      Lifecycle Hooks
                    </div>
                    <div class="space-y-1">
                      <For each={lifecycleReducers()}>
                        {(reducer) => (
                          <button
                            type="button"
                            class="w-full rounded p-2 text-left transition-colors hover:bg-accent"
                            onClick={() => setSelectedReducer(reducer.name)}
                          >
                            <div class="flex items-center gap-2">
                              <span class="font-mono text-foreground text-xs">{reducer.name}</span>
                              <span class="rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] text-blue-400">
                                {reducer.lifecycle}
                              </span>
                            </div>
                            <div class="mt-0.5 text-[10px] text-muted-foreground">
                              {reducer.params.length} parameter
                              {reducer.params.length !== 1 ? "s" : ""}
                            </div>
                          </button>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>

                <Show when={selectedReducerData()}>
                  <div class="border-border border-t bg-accent/50 p-3">
                    <div class="mb-2 flex items-center justify-between">
                      <h4 class="font-medium font-mono text-sm">{selectedReducerData()?.name}</h4>
                      <button
                        type="button"
                        class="text-muted-foreground hover:text-foreground"
                        onClick={() => setSelectedReducer(null)}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </button>
                    </div>
                    {selectedReducerData()?.lifecycle && (
                      <div class="mb-2">
                        <span class="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] text-blue-400">
                          {selectedReducerData()?.lifecycle}
                        </span>
                      </div>
                    )}
                    {selectedReducerData()?.params && selectedReducerData()!.params.length > 0 && (
                      <div class="space-y-1">
                        <div class="text-[10px] text-muted-foreground uppercase tracking-wider">
                          Parameters
                        </div>
                        <For each={selectedReducerData()?.params}>
                          {(param) => (
                            <div class="flex justify-between text-xs">
                              <span class="text-muted-foreground">{param.name}</span>
                              <span class="font-mono text-emerald-400">{param.type}</span>
                            </div>
                          )}
                        </For>
                      </div>
                    )}
                    {selectedReducerData()?.params.length === 0 && (
                      <div class="text-muted-foreground text-xs">No parameters</div>
                    )}
                  </div>
                </Show>
              </div>
              </Show>
            </Show>

            <Show when={view() === "json"}>
              <div class="flex-1 overflow-auto p-4">
                <pre class="bg-muted/30 p-4 font-mono text-[13px] leading-relaxed">
                  <code class="text-foreground/90">{schemaJson()}</code>
                </pre>
              </div>
            </Show>
          </div>
        </Show>
      </main>
    </div>
  )
}
