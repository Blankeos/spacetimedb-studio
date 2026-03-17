import type { ColumnDef } from "@tanstack/solid-table"
import { createSolidTable, flexRender, getCoreRowModel } from "@tanstack/solid-table"
import { createMemo, createSignal, For, Show } from "solid-js"
import { cn } from "@/utils/cn"

interface ResultTableProps {
  columns: string[]
  rows: Record<string, unknown>[]
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
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return <span class="text-amber-400/80">{value}</span>
    }
    return <span class="text-emerald-400/80">"{value}"</span>
  }

  return <span>{String(value)}</span>
}

export function ResultTable(props: ResultTableProps) {
  const [selectedCells, setSelectedCells] = createSignal<Set<string>>(new Set())
  const [editingCell, setEditingCell] = createSignal<{
    row: number
    col: string
    element: HTMLTableCellElement
  } | null>(null)
  const [isSelecting, setIsSelecting] = createSignal(false)
  const [selectionStart, setSelectionStart] = createSignal<{ row: number; col: string } | null>(
    null
  )

  const getCellKey = (rowIndex: number, columnId: string) => `${rowIndex}-${columnId}`

  const columns = createMemo<ColumnDef<Record<string, unknown>>[]>(() =>
    props.columns.map((col) => ({
      id: col,
      accessorKey: col,
      header: () => (
        <span class="whitespace-nowrap font-medium text-muted-foreground text-xs uppercase tracking-wider">
          {col}
        </span>
      ),
      cell: ({ row, column }) => {
        const value = row.original[column.id]
        return <CellValue value={value} />
      },
    }))
  )

  const table = createSolidTable({
    get data() {
      return props.rows
    },
    get columns() {
      return columns()
    },
    getCoreRowModel: getCoreRowModel(),
  })

  const handleCellMouseDown = (e: MouseEvent, rowIndex: number, columnId: string) => {
    if (e.detail === 2) {
      return
    }

    const cellKey = getCellKey(rowIndex, columnId)

    if (e.shiftKey && selectedCells().size > 0) {
      return
    }

    if (!e.ctrlKey && !e.metaKey) {
      setSelectedCells(new Set([cellKey]))
    } else {
      const newSelection = new Set(selectedCells())
      if (newSelection.has(cellKey)) {
        newSelection.delete(cellKey)
      } else {
        newSelection.add(cellKey)
      }
      setSelectedCells(newSelection)
    }

    setSelectionStart({ row: rowIndex, col: columnId })
    setIsSelecting(true)
  }

  const handleCellMouseEnter = (rowIndex: number, columnId: string) => {
    if (!isSelecting() || !selectionStart()) return

    const start = selectionStart()!
    const startColIndex = props.columns.indexOf(start.col)
    const endColIndex = props.columns.indexOf(columnId)
    const startRow = Math.min(start.row, rowIndex)
    const endRow = Math.max(start.row, rowIndex)
    const startCol = Math.min(startColIndex, endColIndex)
    const endCol = Math.max(startColIndex, endColIndex)

    const newSelection = new Set<string>()
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        newSelection.add(getCellKey(r, props.columns[c]))
      }
    }
    setSelectedCells(newSelection)
  }

  const handleMouseUp = () => {
    setIsSelecting(false)
    setSelectionStart(null)
  }

  const handleCellDoubleClick = (e: MouseEvent, rowIndex: number, columnId: string) => {
    const target = e.currentTarget as HTMLTableCellElement
    setEditingCell({ row: rowIndex, col: columnId, element: target })
  }

  const isCellSelected = (rowIndex: number, columnId: string) =>
    selectedCells().has(getCellKey(rowIndex, columnId))

  const getEditingValue = () => {
    const editing = editingCell()
    if (!editing) return null
    return props.rows[editing.row]?.[editing.col]
  }

  const getEditingRect = () => editingCell()?.element.getBoundingClientRect()

  return (
    <section
      class="overflow-auto"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      aria-label="SQL query results table"
    >
      <Show when={editingCell()}>
        <div
          class="fixed z-50 min-w-[200px] rounded border border-primary bg-popover p-2 shadow-lg"
          style={{
            top: `${getEditingRect()?.top ?? 0}px`,
            left: `${getEditingRect()?.left ?? 0}px`,
            width: `${getEditingRect()?.width ?? 200}px`,
          }}
        >
          <textarea
            value={String(getEditingValue() ?? "")}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setEditingCell(null)
              }
            }}
            class="w-full resize-none rounded border border-border bg-background p-2 font-mono text-xs focus:border-primary focus:outline-none"
            rows={3}
            autofocus
          />
          <div class="mt-1.5 flex justify-end gap-1.5">
            <button
              type="button"
              disabled
              class="cursor-not-allowed rounded bg-primary/10 px-2 py-1 text-primary/50 text-xs"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingCell(null)}
              class="rounded px-2 py-1 text-muted-foreground text-xs hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      </Show>
      <table class="w-full select-none text-sm">
        <thead class="sticky top-0 z-10 bg-card">
          <tr class="border-border border-b">
            <For each={table.getHeaderGroups()}>
              {(headerGroup) => (
                <For each={headerGroup.headers}>
                  {(header) => (
                    <th
                      class={cn(
                        "whitespace-nowrap border-border border-r bg-muted/30 px-4 py-2 text-left last:border-r-0"
                      )}
                    >
                      <Show when={!header.isPlaceholder}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </Show>
                    </th>
                  )}
                </For>
              )}
            </For>
          </tr>
        </thead>
        <tbody>
          <For each={table.getRowModel().rows}>
            {(row, index) => (
              <tr
                class={cn(
                  "border-border/50 border-b transition-colors hover:bg-accent/30",
                  index() % 2 === 0 ? "bg-transparent" : "bg-muted/10"
                )}
              >
                <For each={row.getVisibleCells()}>
                  {(cell) => {
                    const columnId = cell.column.id
                    return (
                      <td
                        class={cn(
                          "max-w-[300px] cursor-cell overflow-hidden text-ellipsis whitespace-nowrap border-border/30 border-r px-4 py-2 font-mono text-foreground/90 text-xs last:border-r-0",
                          isCellSelected(index(), columnId) &&
                            "bg-accent/50 ring-1 ring-primary/50 ring-inset"
                        )}
                        onMouseDown={(e) => handleCellMouseDown(e, index(), columnId)}
                        onMouseEnter={() => handleCellMouseEnter(index(), columnId)}
                        onDblClick={(e) => handleCellDoubleClick(e, index(), columnId)}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )
                  }}
                </For>
              </tr>
            )}
          </For>
        </tbody>
      </table>
      <Show when={props.rows.length === 0}>
        <div class="flex items-center justify-center py-12 text-muted-foreground">
          <span class="text-sm">No rows returned</span>
        </div>
      </Show>
    </section>
  )
}
