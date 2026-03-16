import { createSignal, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { PageHeader } from "@/components/page-header"
import { ResultPanel, type StatementResult } from "@/components/sql-editor/ResultPanel"
import { SqlEditor } from "@/components/sql-editor/SqlEditor"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Resizable, ResizableHandle, ResizablePanel } from "@/components/ui/resizable"
import { useDatabase } from "@/contexts/database"
import { honoClient } from "@/lib/hono-client"
import getTitle from "@/utils/get-title"

interface QueryState {
  results: StatementResult[] | null
  isLoading: boolean
  executionTime: number
  lastExecutedAt: Date | null
}

export default function SqlEditorPage() {
  useMetadata({
    title: getTitle("SQL Editor"),
  })

  const { database, setDatabase, loading } = useDatabase()
  const [sql, setSql] = createSignal("-- Write your SQL query here\nSELECT * FROM person LIMIT 10;")
  const [queryState, setQueryState] = createSignal<QueryState>({
    results: null,
    isLoading: false,
    executionTime: 0,
    lastExecutedAt: null,
  })

  const handleDatabaseChange = (db: string) => {
    setDatabase(db)
    const url = new URL(window.location.href)
    url.searchParams.set("db", db)
    window.history.replaceState({}, "", url)
  }

  const executeQuery = async () => {
    if (!database()) {
      setQueryState({
        results: [
          {
            statement: "",
            success: false,
            data: null,
            error: "No database selected. Add ?db=<database> to the URL.",
          },
        ],
        isLoading: false,
        executionTime: 0,
        lastExecutedAt: new Date(),
      })
      return
    }

    const startTime = performance.now()
    setQueryState((prev) => ({ ...prev, isLoading: true, results: null }))

    try {
      const res = await honoClient.spacetime.sql.$post({
        json: {
          sql: sql(),
          database: database(),
        },
      })
      const data = await res.json()

      setQueryState({
        results: data.results,
        isLoading: false,
        executionTime: Math.round(performance.now() - startTime),
        lastExecutedAt: new Date(),
      })
    } catch (error) {
      setQueryState({
        results: [
          {
            statement: "",
            success: false,
            data: null,
            error: error instanceof Error ? error.message : "Failed to execute query",
          },
        ],
        isLoading: false,
        executionTime: Math.round(performance.now() - startTime),
        lastExecutedAt: new Date(),
      })
    }
  }

  const clearResults = () => {
    setQueryState({
      results: null,
      isLoading: false,
      executionTime: 0,
      lastExecutedAt: null,
    })
  }

  return (
    <div class="flex h-full flex-col overflow-hidden bg-background">
      <PageHeader
        title="SpacetimeDB Studio"
        database={database()}
        loading={loading()}
        onDatabaseChange={handleDatabaseChange}
      >
        <div class="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={executeQuery}
            disabled={queryState().isLoading}
            class="gap-1.5"
          >
            <Show
              when={queryState().isLoading}
              fallback={
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
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              }
            >
              <svg
                class="size-3.5 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </Show>
            Run
            <kbd class="hidden h-5 items-center gap-1 border border-primary/30 bg-primary/10 px-1.5 font-medium font-mono text-[10px] text-primary-foreground/80 opacity-60 sm:inline-flex">
              <span class="text-xs">⌘</span>⏎
            </kbd>
          </Button>
        </div>
      </PageHeader>

      {/* Main Content */}
      <div class="flex flex-1 flex-col overflow-hidden">
        <Resizable orientation="vertical" class="h-full">
          <ResizablePanel initialSize={0.5} minSize={0.2} class="overflow-hidden">
            <Card class="m-0 flex h-full flex-1 flex-col overflow-hidden border-0 border-border">
              <CardHeader class="flex h-[33px] shrink-0 flex-row items-center justify-between border-border border-b bg-muted/30 px-3 py-2">
                <CardTitle class="mb-0 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Editor
                </CardTitle>
              </CardHeader>
              <div class="h-full flex-1 overflow-hidden">
                <SqlEditor
                  value={sql()}
                  onChange={setSql}
                  onExecute={executeQuery}
                  class="border-0 bg-[#282C34] focus:outline-0 focus:ring-0"
                />
              </div>
            </Card>
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel initialSize={0.5} minSize={0.2} class="overflow-hidden">
            <ResultPanel
              results={queryState().results}
              isLoading={queryState().isLoading}
              executionTime={queryState().executionTime}
              onClear={clearResults}
            />
          </ResizablePanel>
        </Resizable>
      </div>

      {/* Status Bar */}
      <footer class="flex shrink-0 items-center justify-between border-border border-t bg-card px-4 py-1.5 text-xs">
        <div class="flex items-center gap-4 text-muted-foreground">
          <Show when={queryState().lastExecutedAt}>
            <span>Last run: {queryState().lastExecutedAt?.toLocaleTimeString()}</span>
          </Show>
        </div>
        <div class="flex items-center gap-4 text-muted-foreground">
          <Show when={queryState().executionTime > 0}>
            <span class="font-mono">{queryState().executionTime}ms</span>
          </Show>
          <Show when={queryState().results && queryState().results!.length > 0}>
            <span class="font-mono">
              {queryState().results?.reduce((sum, r) => sum + (r.data?.numRows ?? 0), 0) ?? 0} rows
            </span>
          </Show>
        </div>
      </footer>
    </div>
  )
}
