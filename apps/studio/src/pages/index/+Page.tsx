import { createSignal, Show, createEffect } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { Panel, PanelGroup, ResizeHandle } from "solid-resizable-panels"
import { honoClient } from "@/lib/hono-client"
import getTitle from "@/utils/get-title"
import { SqlEditor } from "@/components/sql-editor/SqlEditor"
import { ResultPanel } from "@/components/sql-editor/ResultPanel"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface QueryResult {
  success: boolean
  data: {
    rows: Record<string, unknown>[]
    columns: string[]
    numRows: number
  } | null
  error: string | null
}

interface QueryState {
  result: QueryResult | null
  isLoading: boolean
  executionTime: number
  lastExecutedAt: Date | null
}

function getDatabaseFromUrl(): string | null {
  if (typeof window === "undefined") return null
  const params = new URLSearchParams(window.location.search)
  return params.get("db")
}

export default function SqlEditorPage() {
  useMetadata({
    title: getTitle("SQL Editor"),
  })

  const [database, setDatabase] = createSignal<string | null>(null)
  const [loading, setLoading] = createSignal(true)
  const [sql, setSql] = createSignal("-- Write your SQL query here\nSELECT * FROM person LIMIT 10;")
  const [vimMode, setVimMode] = createSignal(false)
  const [queryState, setQueryState] = createSignal<QueryState>({
    result: null,
    isLoading: false,
    executionTime: 0,
    lastExecutedAt: null,
  })

  createEffect(() => {
    const urlDb = getDatabaseFromUrl()
    if (urlDb) {
      setDatabase(urlDb)
      setLoading(false)
      return
    }
    
    honoClient.spacetime.config.$get()
      .then(res => res.json())
      .then(data => {
        setDatabase(data.database)
      })
      .finally(() => setLoading(false))
  })

  const executeQuery = async () => {
    if (!database()) {
      setQueryState({
        result: {
          success: false,
          data: null,
          error: "No database selected. Add ?db=<database> to the URL.",
        },
        isLoading: false,
        executionTime: 0,
        lastExecutedAt: new Date(),
      })
      return
    }
    
    const startTime = performance.now()
    setQueryState(prev => ({ ...prev, isLoading: true, result: null }))

    try {
      const res = await honoClient.spacetime.sql.$post({
        json: {
          sql: sql(),
          database: database(),
        },
      })
      const result = await res.json() as QueryResult
      
      setQueryState({
        result,
        isLoading: false,
        executionTime: Math.round(performance.now() - startTime),
        lastExecutedAt: new Date(),
      })
    } catch (error) {
      setQueryState({
        result: {
          success: false,
          data: null,
          error: error instanceof Error ? error.message : "Failed to execute query",
        },
        isLoading: false,
        executionTime: Math.round(performance.now() - startTime),
        lastExecutedAt: new Date(),
      })
    }
  }

  const clearResults = () => {
    setQueryState({
      result: null,
      isLoading: false,
      executionTime: 0,
      lastExecutedAt: null,
    })
  }

  const clearEditor = () => {
    setSql("")
  }

  return (
    <div class="flex flex-col h-screen overflow-hidden bg-background">
      {/* Header / Toolbar */}
      <header class="border-b border-border bg-card px-4 py-3 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <Show when={loading()}>
              <div class="size-3 rounded-full bg-muted-foreground/50 animate-pulse" />
              <span class="font-mono text-sm text-muted-foreground">Loading...</span>
            </Show>
            <Show when={!loading()}>
              <div class={`size-3 rounded-full ${database() ? 'bg-primary animate-pulse' : 'bg-destructive'} `} />
              <span class="font-mono text-sm font-medium text-foreground">
                {database() || "No database selected"}
              </span>
            </Show>
          </div>
          <div class="h-4 w-px bg-border" />
          <span class="text-muted-foreground text-xs">SpacetimeDB Studio</span>
        </div>

        <div class="flex items-center gap-2">
          <Button
            variant={vimMode() ? "default" : "outline"}
            size="sm"
            onClick={() => setVimMode(!vimMode())}
            class="gap-1.5"
          >
            <span class="font-mono text-xs">VIM</span>
            <Show when={vimMode()}>
              <span class="size-1.5 rounded-full bg-green-400" />
            </Show>
          </Button>
          
          <div class="h-4 w-px bg-border mx-1" />
          
          <Button
            variant="outline"
            size="sm"
            onClick={clearEditor}
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
              class="mr-1.5"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
            Clear
          </Button>
          
          <Button
            variant="default"
            size="sm"
            onClick={executeQuery}
            disabled={queryState().isLoading}
            class="gap-1.5 bg-primary hover:bg-primary/90"
          >
            <Show when={queryState().isLoading}
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
                class="animate-spin size-3.5"
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
            <kbd class="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-primary/30 bg-primary/10 px-1.5 font-mono text-[10px] font-medium text-primary-foreground/80 opacity-60">
              <span class="text-xs">Cmd</span>↵
            </kbd>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div class="flex-1 overflow-hidden">
        <PanelGroup direction="column" class="h-full">
          <Panel id="editor" initialSize={50} minSize={20} class="flex flex-col">
            <Card class="m-2 flex-1 flex flex-col border-border/50 bg-card/50 overflow-hidden">
              <div class="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/30">
                <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Editor
                </span>
                <Show when={vimMode()}>
                  <span class="text-xs font-mono text-primary">-- NORMAL --</span>
                </Show>
              </div>
              <div class="flex-1 overflow-hidden">
                <SqlEditor
                  value={sql()}
                  onChange={setSql}
                  onExecute={executeQuery}
                  vimMode={vimMode()}
                  class="border-0 rounded-none"
                />
              </div>
            </Card>
          </Panel>

          <ResizeHandle class="h-1.5 bg-border/30 hover:bg-primary/30 transition-colors flex items-center justify-center">
            <div class="w-8 h-1 rounded-full bg-border/50" />
          </ResizeHandle>

          <Panel id="results" initialSize={50} minSize={20} class="flex flex-col">
            <ResultPanel
              result={queryState().result}
              isLoading={queryState().isLoading}
              executionTime={queryState().executionTime}
              onClear={clearResults}
            />
          </Panel>
        </PanelGroup>
      </div>

      {/* Status Bar */}
      <footer class="border-t border-border bg-card px-4 py-1.5 flex items-center justify-between shrink-0 text-xs">
        <div class="flex items-center gap-4 text-muted-foreground">
          <Show when={queryState().lastExecutedAt}>
            <span>
              Last run: {queryState().lastExecutedAt?.toLocaleTimeString()}
            </span>
          </Show>
        </div>
        <div class="flex items-center gap-4 text-muted-foreground">
          <Show when={queryState().executionTime > 0}>
            <span class="font-mono">
              {queryState().executionTime}ms
            </span>
          </Show>
          <Show when={queryState().result?.data}>
            <span class="font-mono">
              {queryState().result?.data?.numRows ?? 0} rows
            </span>
          </Show>
        </div>
      </footer>
    </div>
  )
}
