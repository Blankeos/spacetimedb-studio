import { createEffect, createSignal, For, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { useDatabase } from "@/contexts/database"
import { TableIcon } from "@/icons/sidebar-icons"
import { honoClient } from "@/lib/hono-client"
import getTitle from "@/utils/get-title"

useMetadata.setGlobalDefaults({
  title: getTitle("Tables"),
  description: "SpacetimeDB Studio - View and browse tables",
})

interface QueryResult {
  rows: Record<string, unknown>[]
  columns: string[]
  numRows: number
}

const FilterIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
)

const RefreshIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 16h5v5" />
  </svg>
)

export default function TablesPage() {
  const { database, setDatabase, selectedTable, loading } = useDatabase()
  const [queryResult, setQueryResult] = createSignal<QueryResult | null>(null)
  const [queryLoading, setQueryLoading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [whereClause, setWhereClause] = createSignal("")
  const [limit, setLimit] = createSignal(100)

  const handleDatabaseChange = (db: string) => {
    setDatabase(db)
    const url = new URL(window.location.href)
    url.searchParams.set("db", db)
    window.history.replaceState({}, "", url)
  }

  const fetchTableData = () => {
    const db = database()
    const table = selectedTable()

    if (!db || !table) {
      setQueryResult(null)
      setError(null)
      return
    }

    setQueryLoading(true)
    setError(null)

    const params: Record<string, string> = { db, table }
    const where = whereClause().trim()
    if (where) params.where = where
    params.limit = String(limit())

    honoClient.spacetime.query
      .$get({ query: params })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setQueryResult(() => data.data)
        } else if (data.error) {
          setError(data.error)
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to fetch table data")
      })
      .finally(() => setQueryLoading(false))
  }

  createEffect(() => {
    const db = database()
    const table = selectedTable()
    if (db && table) {
      setWhereClause("")
      fetchTableData()
    }
  })

  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return "NULL"
    if (typeof value === "object") return JSON.stringify(value)
    return String(value)
  }

  return (
    <div class="flex h-full flex-col overflow-hidden bg-background">
      <PageHeader
        title={selectedTable() || "Tables"}
        database={database()}
        loading={loading()}
        onDatabaseChange={handleDatabaseChange}
      />

      <main class="flex-1 overflow-auto p-4">
        <Show when={!database()}>
          <Card>
            <CardContent class="py-8">
              <div class="text-center">
                <TableIcon class="mx-auto mb-4 size-12 text-muted-foreground/50" />
                <h2 class="mb-2 font-medium text-lg">No database selected</h2>
                <p class="text-muted-foreground text-sm">
                  Select a database from the header above to view tables
                </p>
              </div>
            </CardContent>
          </Card>
        </Show>

        <Show when={database() && !selectedTable()}>
          <Card>
            <CardContent class="py-8">
              <div class="text-center">
                <TableIcon class="mx-auto mb-4 size-12 text-muted-foreground/50" />
                <h2 class="mb-2 font-medium text-lg">Select a table</h2>
                <p class="text-muted-foreground text-sm">
                  Choose a table from the sidebar to view its contents
                </p>
              </div>
            </CardContent>
          </Card>
        </Show>

        <Show when={database() && selectedTable()}>
          <div class="mb-4 flex items-center gap-3">
            <div class="flex items-center gap-2">
              <FilterIcon />
              <span class="text-muted-foreground text-sm">WHERE</span>
            </div>
            <input
              type="text"
              placeholder="e.g. name = 'Alice' AND age > 18"
              value={whereClause()}
              onInput={(e) => setWhereClause(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  fetchTableData()
                }
              }}
              class="flex-1 border border-border bg-background px-3 py-1.5 font-mono text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => {
                fetchTableData()
              }}
              disabled={queryLoading()}
              class="flex items-center gap-1.5 border border-border bg-muted px-3 py-1.5 text-sm transition-colors hover:bg-accent disabled:opacity-50"
            >
              <RefreshIcon />
              <span>Run</span>
            </button>
          </div>

          <Show when={error()}>
            <Card class="mb-4">
              <CardContent class="py-4">
                <div class="flex items-center gap-2 text-destructive">
                  <span class="font-medium">Error:</span>
                  <span class="font-mono text-sm">{error()}</span>
                </div>
              </CardContent>
            </Card>
          </Show>

          <Show when={queryLoading()}>
            <Card>
              <CardContent class="py-8">
                <div class="text-center text-muted-foreground">Loading table data...</div>
              </CardContent>
            </Card>
          </Show>

          <Show when={queryResult() && !queryLoading()}>
            <Card>
              <CardContent class="p-0">
                <div class="overflow-x-auto">
                  <table class="w-full border-collapse text-sm">
                    <thead>
                      <tr class="border-b border-border bg-muted/50">
                        <For each={queryResult()?.columns ?? []}>
                          {(column) => (
                            <th class="border-border px-4 py-2 text-left font-medium">{column}</th>
                          )}
                        </For>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={queryResult()?.rows ?? []}>
                        {(row) => (
                          <tr class="border-b border-border/50 hover:bg-muted/30">
                            <For each={queryResult()?.columns ?? []}>
                              {(column) => (
                                <td class="max-w-xs truncate px-4 py-2 font-mono text-xs">
                                  {formatCellValue(row[column])}
                                </td>
                              )}
                            </For>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
                <Show when={(queryResult()?.rows?.length ?? 0) === 0}>
                  <div class="py-8 text-center text-muted-foreground">No rows in this table</div>
                </Show>
                <Show when={(queryResult()?.rows?.length ?? 0) > 0}>
                  <div class="border-t border-border px-4 py-2 text-muted-foreground text-xs">
                    {queryResult()?.rows?.length ?? 0} rows
                  </div>
                </Show>
              </CardContent>
            </Card>
          </Show>
        </Show>
      </main>
    </div>
  )
}