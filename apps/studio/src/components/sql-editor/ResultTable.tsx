import type { ColumnDef } from "@tanstack/solid-table"
import { createSolidTable, flexRender, getCoreRowModel } from "@tanstack/solid-table"
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import { Tippy } from "@/lib/solid-tippy/tippy"
import { cn } from "@/utils/cn"

const EDIT_DIALOG_HEIGHT = 140

export interface CellEdit {
  rowIndex: number
  columnId: string
  oldValue: unknown
  newValue: unknown
  row: Record<string, unknown>
  primaryKeyColumns: string[]
  tableName: string | null
}

interface ResultTableProps {
  columns: string[]
  rows: Record<string, unknown>[]
  tableName?: string | null
  primaryKeyColumns?: string[]
  onSave?: (edit: CellEdit) => Promise<void>
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
  const [editValue, setEditValue] = createSignal<string>("")
  const [isSaving, setIsSaving] = createSignal(false)
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
    const currentValue = props.rows[rowIndex]?.[columnId]
    const displayValue = String(currentValue ?? "")
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
    setEditValue(displayValue)
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

  const getDialogPosition = () => {
    const rect = getEditingRect()
    if (!rect) return { top: 0, left: 0, width: 200, placement: "below" as const }

    const viewportHeight = window.innerHeight
    const spaceBelow = viewportHeight - rect.bottom
    const spaceAbove = rect.top
    const placeAbove = spaceBelow < EDIT_DIALOG_HEIGHT && spaceAbove > spaceBelow

    return {
      top: placeAbove ? rect.top - EDIT_DIALOG_HEIGHT : rect.top,
      left: rect.left,
      width: rect.width,
      placement: placeAbove ? "above" : "below",
    } as const
  }

  const handleSave = async () => {
    const editing = editingCell()
    if (!editing) return

    const oldValue = props.rows[editing.row]?.[editing.col]
    const newValue = editValue()

    if (props.onSave) {
      setIsSaving(true)
      try {
        await props.onSave({
          rowIndex: editing.row,
          columnId: editing.col,
          oldValue,
          newValue,
          row: props.rows[editing.row],
          primaryKeyColumns: props.primaryKeyColumns ?? [],
          tableName: props.tableName ?? null,
        })
        setEditingCell(null)
      } catch (error) {
        console.error("Failed to save:", error)
      } finally {
        setIsSaving(false)
      }
    } else {
      setEditingCell(null)
    }
  }

  createEffect(() => {
    if (!editingCell()) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditingCell(null)
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSave()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown))
  })

  return (
    <section
      class="overflow-auto"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      aria-label="SQL query results table"
    >
      <Show when={editingCell()}>
        {(editing) => {
          const pkCols = props.primaryKeyColumns ?? []
          const hasPk = pkCols.length > 0
          const row = props.rows[editing().row]
          const pkHasNull = pkCols.some((col) => row?.[col] === null || row?.[col] === undefined)
          const canSave = hasPk && !pkHasNull
          return (
            <div
              class="fixed z-50 min-w-[200px] border border-border bg-popover p-2 shadow-lg"
              style={{
                top: `${getDialogPosition().top}px`,
                left: `${getDialogPosition().left}px`,
                width: `${getDialogPosition().width}px`,
              }}
            >
              <textarea
                ref={(el) => {
                  queueMicrotask(() => el.focus())
                }}
                value={editValue()}
                onInput={(e) => setEditValue(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setEditingCell(null)
                  } else if (e.key === "Enter" && e.shiftKey && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    handleSave()
                  }
                }}
                class="w-full resize-none border border-border bg-background p-2 font-mono text-xs focus:border-primary focus:outline-none"
                rows={3}
              />
              <div class="mt-1.5 flex items-center justify-between">
                <div class="text-[10px] text-muted-foreground">
                  <Show when={!hasPk}>
                    <Tippy
                      content="Can't make an SQL query to target this cell"
                      props={{ placement: "bottom" }}
                    >
                      <span class="italic">No primary key</span>
                    </Tippy>
                  </Show>
                  <Show when={hasPk && props.tableName}>
                    <span class="font-mono">
                      {pkCols.map((col, idx) => {
                        const isNull = row?.[col] === null || row?.[col] === undefined
                        const value = String(row?.[col] ?? "NULL")
                        return (
                          <>
                            {idx > 0 && <span class="text-muted-foreground/70">, </span>}
                            <span class="text-muted-foreground/70">{col}=</span>
                            <Show
                              when={isNull}
                              fallback={<span class="text-foreground">{value}</span>}
                            >
                              <Tippy
                                content="Primary key is NULL - cannot uniquely identify row"
                                props={{ placement: "bottom" }}
                              >
                                <span class="cursor-default text-red-400">{value}</span>
                              </Tippy>
                            </Show>
                          </>
                        )
                      })}
                    </span>
                  </Show>
                </div>
                <div class="flex gap-1.5">
                  <Show
                    when={!canSave}
                    fallback={
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving() || !props.onSave}
                        class={cn(
                          "px-2 py-1 text-xs",
                          isSaving() && "cursor-wait opacity-50",
                          "bg-primary text-primary-foreground hover:bg-primary/90"
                        )}
                      >
                        {isSaving() ? "Saving..." : "Save"}
                        <Show when={!isSaving()}>
                          <span class="ml-1 opacity-60">⌘⇧⏎</span>
                        </Show>
                      </button>
                    }
                  >
                    <Tippy
                      content={
                        !hasPk
                          ? "No primary key"
                          : "Primary key is NULL - cannot uniquely identify row"
                      }
                      props={{ placement: "bottom" }}
                    >
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled
                        class="cursor-not-allowed bg-primary/10 px-2 py-1 text-primary/50 text-xs"
                      >
                        Save
                        <span class="ml-1 opacity-60">⌘⇧⏎</span>
                      </button>
                    </Tippy>
                  </Show>
                  <button
                    type="button"
                    onClick={() => setEditingCell(null)}
                    class="px-2 py-1 text-muted-foreground text-xs hover:bg-accent"
                  >
                    Cancel
                    <span class="ml-1 opacity-60">Esc</span>
                  </button>
                </div>
              </div>
            </div>
          )
        }}
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
