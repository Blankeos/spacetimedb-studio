import type { Component } from "solid-js"
import { Show } from "solid-js"
import { type CellEdit, ResultTable } from "@/components/sql-editor/ResultTable"

interface DataTableProps {
  columns: string[]
  rows: Record<string, unknown>[]
  tableName?: string | null
  primaryKeyColumns?: string[]
  onSave?: (edit: CellEdit) => Promise<void>
  onDeleteRow?: (row: Record<string, unknown>) => Promise<void>
  class?: string
}

export const DataTable: Component<DataTableProps> = (props) => {
  return (
    <Show
      when={props.rows.length > 0}
      fallback={
        <div class="flex items-center justify-center py-12 text-muted-foreground">
          <span class="text-sm">No rows returned</span>
        </div>
      }
    >
      <div class={`overflow-auto ${props.class ?? ""}`}>
        <ResultTable
          columns={props.columns}
          rows={props.rows}
          tableName={props.tableName}
          primaryKeyColumns={props.primaryKeyColumns}
          onSave={props.onSave}
          onDeleteRow={props.onDeleteRow}
        />
      </div>
    </Show>
  )
}
