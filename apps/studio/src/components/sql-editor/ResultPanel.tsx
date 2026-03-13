import { type Component, For, Show } from "solid-js"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/utils/cn"

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
  const copyAsCsv = () => {
    const data = props.result?.data
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
    navigator.clipboard.writeText(csv)
  }

  return (
    <Card class="m-0 flex h-full flex-1 flex-col overflow-hidden border-0 border-border bg-card">
      <CardHeader class="flex h-[33px] shrink-0 flex-row items-center justify-between border-border border-b bg-muted/30 px-3 py-2">
        <CardTitle class="mb-0 font-medium text-muted-foreground text-xs uppercase tracking-wider">
          Results
        </CardTitle>
        <div class="flex items-center gap-2">
          <Show when={props.result && !props.isLoading}>
            <Button
              variant="ghost"
              size="xs"
              onClick={copyAsCsv}
              class="h-6 px-2 text-muted-foreground hover:text-foreground"
            >
              Copy CSV
            </Button>
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

        <Show when={!props.isLoading && !props.result}>
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

        <Show when={!props.isLoading && props.result?.success && props.result.data}>
          <div class="overflow-auto">
            <table class="w-full text-sm">
              <thead class="sticky top-0 z-10 bg-card">
                <tr class="border-border border-b">
                  <For each={props.result?.data?.columns}>
                    {(column) => (
                      <th class="whitespace-nowrap border-border border-r bg-muted/30 px-4 py-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider last:border-r-0">
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
                        "border-border/50 border-b transition-colors hover:bg-accent/30",
                        index() % 2 === 0 ? "bg-transparent" : "bg-muted/10"
                      )}
                    >
                      <For each={props.result?.data?.columns}>
                        {(column) => (
                          <td class="max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap border-border/30 border-r px-4 py-2 font-mono text-foreground/90 text-xs last:border-r-0">
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
      <span class={value ? "text-emerald-400" : "text-red-400"}>{value ? "true" : "false"}</span>
    )
  }

  if (typeof value === "number") {
    return <span class="text-sky-400">{value}</span>
  }

  if (typeof value === "string") {
    // Check if it looks like a date
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return <span class="text-amber-400/80">{value}</span>
    }
    return <span class="text-emerald-400/80">"{value}"</span>
  }

  return <span>{String(value)}</span>
}
