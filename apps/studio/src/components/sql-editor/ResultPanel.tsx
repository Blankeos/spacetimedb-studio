import { Show, For, type Component } from "solid-js"
import { cn } from "@/utils/cn"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface QueryResult {
  success: boolean
  data: {
    rows: Record<string, unknown>[]
    columns: string[]
    numRows: number
  } | null
  error: string | null
}

interface ResultPanelProps {
  result: QueryResult | null
  isLoading: boolean
  executionTime: number
  onClear: () => void
}

export const ResultPanel: Component<ResultPanelProps> = (props) => {
  return (
    <Card class="m-2 flex-1 flex flex-col border-border/50 bg-card/50 overflow-hidden">
      <CardHeader class="flex flex-row items-center justify-between py-2 px-3 border-b border-border/50 bg-muted/30 shrink-0">
        <CardTitle class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Results
        </CardTitle>
        <div class="flex items-center gap-2">
          <Show when={props.result && !props.isLoading}>
            <Button
              variant="ghost"
              size="xs"
              onClick={props.onClear}
              class="h-6 px-2 text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
          </Show>
        </div>
      </CardHeader>

      <CardContent class="flex-1 overflow-auto p-0">
        <Show when={props.isLoading}>
          <div class="flex items-center justify-center h-full">
            <div class="flex flex-col items-center gap-3">
              <div class="relative">
                <div class="size-8 rounded-full border-2 border-border border-t-primary animate-spin" />
              </div>
              <span class="text-sm text-muted-foreground">Executing query...</span>
            </div>
          </div>
        </Show>

        <Show when={!props.isLoading && !props.result}>
          <div class="flex flex-col items-center justify-center h-full text-muted-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="40"
              height="40"
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
            <p class="text-xs mt-1 opacity-60">Press Cmd+Enter or click Run</p>
          </div>
        </Show>

        <Show when={!props.isLoading && props.result?.success && props.result.data}>
          <div class="overflow-auto">
            <table class="w-full text-sm">
              <thead class="sticky top-0 bg-card z-10">
                <tr class="border-b border-border">
                  <For each={props.result?.data?.columns}>
                    {(column) => (
                      <th class="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap bg-muted/30 border-r border-border/50 last:border-r-0">
                        {column}
                      </th>
                    )}
                  </For>
                </tr>
              </thead>
              <tbody>
                <For each={props.result?.data?.rows}>
                  {(row, index) => (
                    <tr
                      class={cn(
                        "border-b border-border/50 hover:bg-accent/30 transition-colors",
                        index() % 2 === 0 ? "bg-transparent" : "bg-muted/10"
                      )}
                    >
                      <For each={props.result?.data?.columns}>
                        {(column) => (
                          <td class="px-4 py-2 font-mono text-xs text-foreground/90 border-r border-border/30 last:border-r-0 whitespace-nowrap overflow-hidden text-ellipsis max-w-[300px]">
                            <CellValue value={row[column]} />
                          </td>
                        )}
                      </For>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
            <Show when={props.result?.data && props.result.data.numRows === 0}>
              <div class="flex items-center justify-center py-12 text-muted-foreground">
                <span class="text-sm">No rows returned</span>
              </div>
            </Show>
          </div>
        </Show>

        <Show when={!props.isLoading && props.result && !props.result.success}>
          <div class="flex flex-col p-4">
            <div class="flex items-start gap-3 p-4 rounded-md bg-destructive/10 border border-destructive/30 text-destructive">
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
                class="shrink-0 mt-0.5"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div class="flex-1 min-w-0">
                <p class="font-medium text-sm">Query Error</p>
                <p class="text-sm mt-1 opacity-90 font-mono break-words">
                  {props.result?.error || "An unknown error occurred"}
                </p>
              </div>
            </div>
          </div>
        </Show>
      </CardContent>
    </Card>
  )
}

function CellValue(props: { value: unknown }) {
  const value = props.value

  if (value === null || value === undefined) {
    return <span class="text-muted-foreground italic">NULL</span>
  }

  if (typeof value === "boolean") {
    return (
      <span class={value ? "text-green-400" : "text-red-400"}>
        {value ? "true" : "false"}
      </span>
    )
  }

  if (typeof value === "number") {
    return <span class="text-cyan-400">{value}</span>
  }

  if (typeof value === "string") {
    // Check if it looks like a date
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return <span class="text-amber-400/80">{value}</span>
    }
    return <span class="text-green-400/80">"{value}"</span>
  }

  return <span>{String(value)}</span>
}
