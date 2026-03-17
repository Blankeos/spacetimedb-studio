import { useClipboard } from "bagon-hooks"
import { type Component, For, Show } from "solid-js"
import { toast } from "solid-sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { type CellEdit, ResultTable } from "./ResultTable"

const CheckIcon = (props: { class?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <path d="M20 6L9 17l-5-5" />
  </svg>
)

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

interface ResultPanelProps {
  results: StatementResult[] | null
  isLoading: boolean
  executionTime: number
  onClear: () => void
  tableName?: string | null
  primaryKeyColumns?: string[]
  onSave?: (edit: CellEdit) => Promise<void>
}

function getStatementLabel(statement: string): string {
  const trimmed = statement.trim()
  const firstLine = trimmed.split("\n")[0]?.trim() ?? trimmed
  const truncated = firstLine.length > 40 ? `${firstLine.slice(0, 40)}...` : firstLine
  return truncated.replace(/;$/, "")
}

export const ResultPanel: Component<ResultPanelProps> = (props) => {
  const hasResults = () => props.results && props.results.length > 0
  const hasMultipleResults = () => props.results && props.results.length > 1

  const clipboard = useClipboard()
  const sqlClipboard = useClipboard()

  const copyAsCsv = (result: StatementResult) => {
    const data = result.data
    if (!data) return

    const columns = data.columns
    const rows = data.rows

    const header = columns.join(",")
    const csvRows = rows.map((row) =>
      columns
        .map((col) => {
          const value = row[col]
          if (value === null || value === undefined) return ""
          const str = String(value)
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`
          }
          return str
        })
        .join(",")
    )
    const csv = [header, ...csvRows].join("\n")
    clipboard.copy(csv)
  }

  const copyStatement = (statement: string) => {
    sqlClipboard.copy(statement)
    toast.success("SQL copied to clipboard")
  }

  const renderResultTable = (result: StatementResult) => (
    <Show
      when={result.success && result.data}
      fallback={
        <div class="flex h-full flex-col items-center justify-center p-4">
          <div class="flex items-start gap-3 border border-destructive/30 bg-destructive/10 p-4 text-destructive">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="mt-0.5 shrink-0"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div class="min-w-0 flex-1">
              <p class="font-medium text-sm">Query Error</p>
              <p class="mt-1 break-words font-mono text-sm opacity-90">
                {result.error || "An unknown error occurred"}
              </p>
            </div>
          </div>
        </div>
      }
    >
      <ResultTable
        columns={result.data!.columns}
        rows={result.data!.rows}
        tableName={props.tableName}
        primaryKeyColumns={props.primaryKeyColumns}
        onSave={props.onSave}
      />
    </Show>
  )

  return (
    <Card class="m-0 flex h-full flex-1 flex-col overflow-hidden border-0 border-border bg-card">
      <CardHeader class="flex h-[33px] shrink-0 flex-row items-center justify-between border-border border-b bg-muted/30 px-3 py-2">
        <CardTitle class="mb-0 font-medium text-muted-foreground text-xs uppercase tracking-wider">
          Results
        </CardTitle>
        <div class="flex items-center gap-2">
          <Show when={hasResults() && !props.isLoading}>
            <Button
              variant="ghost"
              size="xs"
              type="button"
              onClick={props.onClear}
              class="h-6 px-2 text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
          </Show>
        </div>
      </CardHeader>

      <CardContent class="flex h-full flex-1 flex-col overflow-auto p-0">
        <Show when={props.isLoading}>
          <div class="flex h-full items-center justify-center">
            <div class="flex flex-col items-center gap-3">
              <div class="relative">
                <div class="size-6 animate-spin border-2 border-border border-t-primary" />
              </div>
              <span class="text-muted-foreground text-sm">Executing query...</span>
            </div>
          </div>
        </Show>

        <Show when={!props.isLoading && !hasResults()}>
          <div class="h-full">
            <div class="flex h-full flex-col items-center justify-center text-muted-foreground">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="mb-3 opacity-40"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p class="text-sm">Run a query to see results</p>
              <p class="mt-1 text-xs opacity-60">Press ⌘ + ⏎ or click Run</p>
            </div>
          </div>
        </Show>

        <Show when={!props.isLoading && hasResults()}>
          <Show
            when={hasMultipleResults()}
            fallback={(() => {
              const firstResult = () => props.results?.[0]
              return (
                <Show when={firstResult()}>
                  {(result) => (
                    <div class="flex h-full flex-col">
                      <div class="flex shrink-0 items-center justify-between border-border border-b bg-muted/20 px-3 py-1.5">
                        <span
                          class="max-w-[50%] cursor-pointer truncate font-mono text-muted-foreground text-xs hover:text-foreground"
                          role="button"
                          tabIndex={0}
                          onClick={() => copyStatement(result().statement)}
                          onKeyUp={(e) => e.key === "Enter" && copyStatement(result().statement)}
                        >
                          {getStatementLabel(result().statement)}
                        </span>
                        <div class="flex items-center gap-2">
                          <Show when={result().success && result().data}>
                            <span class="font-mono text-muted-foreground text-xs">
                              {result().data?.numRows ?? 0} rows
                            </span>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => copyAsCsv(result())}
                              class="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                            >
                              <Show when={clipboard.copied()} fallback="Copy CSV">
                                <span class="flex items-center gap-1 text-emerald-500">
                                  <CheckIcon class="size-3" />
                                  Copied
                                </span>
                              </Show>
                            </Button>
                          </Show>
                        </div>
                      </div>
                      <div class="flex-1 overflow-auto">{renderResultTable(result())}</div>
                    </div>
                  )}
                </Show>
              )
            })()}
          >
            <Tabs defaultValue="0" class="flex h-full flex-col">
              <TabsList class="w-full justify-start">
                <For each={props.results}>
                  {(result, index) => (
                    <TabsTrigger value={String(index())}>
                      <span class="flex items-center gap-1.5">
                        <Show
                          when={result.success}
                          fallback={<span class="size-1.5 rounded-full bg-red-500" />}
                        >
                          <span class="size-1.5 rounded-full bg-emerald-500" />
                        </Show>
                        {getStatementLabel(result.statement)}
                      </span>
                    </TabsTrigger>
                  )}
                </For>
              </TabsList>
              <For each={props.results}>
                {(result, index) => (
                  <TabsContent value={String(index())} class="flex-1 overflow-auto">
                    <div class="flex h-full flex-col">
                      <div class="flex shrink-0 items-center justify-between border-border border-b bg-muted/20 px-3 py-1.5">
                        <div class="flex min-w-0 flex-1 items-center gap-2">
                          <Show
                            when={result.success}
                            fallback={
                              <span class="rounded bg-red-500/10 px-1.5 py-0.5 font-mono text-[10px] text-red-400">
                                Error
                              </span>
                            }
                          >
                            <span class="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
                              Success
                            </span>
                          </Show>
                          <span
                            class="max-w-[300px] cursor-pointer truncate font-mono text-muted-foreground text-xs hover:text-foreground"
                            role="button"
                            tabIndex={0}
                            onClick={() => copyStatement(result.statement)}
                            onKeyUp={(e) => e.key === "Enter" && copyStatement(result.statement)}
                          >
                            {getStatementLabel(result.statement)}
                          </span>
                        </div>
                        <div class="flex items-center gap-2">
                          <Show when={result.success && result.data}>
                            <span class="font-mono text-muted-foreground text-xs">
                              {result.data?.numRows ?? 0} rows
                            </span>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => copyAsCsv(result)}
                              class="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                            >
                              <Show when={clipboard.copied()} fallback="Copy CSV">
                                <span class="flex items-center gap-1 text-emerald-500">
                                  <CheckIcon class="size-3" />
                                  Copied
                                </span>
                              </Show>
                            </Button>
                          </Show>
                        </div>
                      </div>
                      <div class="flex-1 overflow-auto">{renderResultTable(result)}</div>
                    </div>
                  </TabsContent>
                )}
              </For>
            </Tabs>
          </Show>
        </Show>
      </CardContent>
    </Card>
  )
}
