import { createEffect, createSignal, onCleanup, Show } from "solid-js"
import { toast } from "solid-sonner"
import { useMetadata } from "vike-metadata-solid"
import { DataTable } from "@/components/data-table"
import { PageHeader } from "@/components/page-header"
import type { CellEdit } from "@/components/sql-editor/ResultTable"
import { Card, CardContent } from "@/components/ui/card"
import { useDatabase } from "@/contexts/database"
import { useSpacetime } from "@/contexts/spacetime"
import { useTableSchemas } from "@/hooks/useTableSchemas"
import { TableIcon } from "@/icons/sidebar-icons"
import { honoClient } from "@/lib/hono-client"
import { Tippy } from "@/lib/solid-tippy/tippy"
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

function formatSqlValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL"
  if (typeof value === "bigint") return value.toString()
  if (typeof value === "string") {
    const escaped = value
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "''")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t")
    return `'${escaped}'`
  }
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "number") return String(value)
  const strValue = String(value)
  const escaped = strValue
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "''")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
  return `'${escaped}'`
}

function serializeRow(row: Record<string, unknown>): string {
  function convert(val: unknown): unknown {
    if (typeof val === "bigint") return val.toString()
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const obj: Record<string, unknown> = {}
      for (const k of Object.keys(val as Record<string, unknown>)) {
        obj[k] = convert((val as Record<string, unknown>)[k])
      }
      return obj
    }
    if (Array.isArray(val)) {
      return val.map(convert)
    }
    return val
  }
  const serialized: Record<string, unknown> = {}
  for (const key of Object.keys(row)) {
    serialized[key] = convert(row[key])
  }
  return JSON.stringify(serialized)
}

export default function TablesPage() {
  const { database, setDatabase, selectedTable, loading } = useDatabase()
  const spacetime = useSpacetime()
  const tableSchemas = useTableSchemas(() => database() ?? undefined)
  const [queryResult, setQueryResult] = createSignal<QueryResult | null>(null)
  const [queryLoading, setQueryLoading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [isRealTime, setIsRealTime] = createSignal(false)
  const [connectingTo, setConnectingTo] = createSignal<string | null>(null)

  const currentPrimaryKeyColumns = () => {
    const table = selectedTable()
    if (!table) return []
    const schema = tableSchemas().get(table)
    return schema?.primaryKeyColumns ?? []
  }

  const handleDatabaseChange = (db: string) => {
    setDatabase(db)
    const url = new URL(window.location.href)
    url.searchParams.set("db", db)
    window.history.replaceState({}, "", url)
  }

  createEffect(() => {
    const db = database()
    const currentConnecting = connectingTo()
    const isConnected = spacetime.isConnected()

    if (db && currentConnecting !== db && !isConnected) {
      setConnectingTo(db)
      setError(null)
      spacetime.connect(db).catch((err) => {
        console.error("Failed to connect to SpacetimeDB:", err)
        setError(err instanceof Error ? err.message : "Connection failed")
        setConnectingTo(null)
      })
    }

    if (isConnected && currentConnecting) {
      setConnectingTo(null)
    }
  })

  createEffect(() => {
    const table = selectedTable()
    const isConnected = spacetime.isConnected()
    const connState = spacetime.getConnectionState()

    if (!table) {
      setQueryResult(null)
      setIsRealTime(false)
      return
    }

    if (!isConnected) {
      if (connState === "error") {
        const err = spacetime.connectionError()
        setError(err)
        setQueryLoading(false)
      }
      return
    }

    let cleanup: (() => void) | null = null

    setQueryLoading(true)
    setError(null)
    setQueryResult(null)

    cleanup = spacetime.subscribeToTable(table, {
      onApplied: (rows) => {
        setQueryLoading(true)
        setIsRealTime(true)
        if (rows.length > 0) {
          const columns = Object.keys(rows[0])
          setQueryResult({ rows, columns, numRows: rows.length })
        } else {
          setQueryResult({ rows: [], columns: [], numRows: 0 })
        }
        setQueryLoading(false)
      },
      onInsert: (row) => {
        setQueryResult((prev) => {
          const columns = Object.keys(row)
          if (!prev) {
            return { rows: [row], columns, numRows: 1 }
          }
          const rowKey = serializeRow(row)
          const exists = prev.rows.some((r) => serializeRow(r) === rowKey)
          if (exists) return prev
          return {
            ...prev,
            columns: prev.columns.length > 0 ? prev.columns : columns,
            rows: [...prev.rows, row],
            numRows: prev.numRows + 1,
          }
        })
      },
      onDelete: (row) => {
        setQueryResult((prev) => {
          if (!prev) return prev
          const rowKey = serializeRow(row)
          return {
            ...prev,
            rows: prev.rows.filter((r) => serializeRow(r) !== rowKey),
            numRows: Math.max(0, prev.numRows - 1),
          }
        })
      },
      onUpdate: (oldRow, newRow) => {
        setQueryResult((prev) => {
          if (!prev) return prev
          const oldKey = serializeRow(oldRow)
          return {
            ...prev,
            rows: prev.rows.map((r) => (serializeRow(r) === oldKey ? newRow : r)),
          }
        })
      },
    })

    onCleanup(() => {
      cleanup?.()
    })
  })

  const handleCellSave = async (edit: CellEdit) => {
    const { tableName, primaryKeyColumns, columnId, newValue, row } = edit

    if (!tableName || primaryKeyColumns.length === 0) {
      toast.error("Cannot save: No primary key found for this table")
      return
    }

    const setClause = `${columnId} = ${formatSqlValue(newValue)}`
    const whereClause = primaryKeyColumns
      .map((col) => `${col} = ${formatSqlValue(row[col])}`)
      .join(" AND ")

    const updateSql = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause};`

    const copyToClipboard = async () => {
      try {
        await navigator.clipboard.writeText(updateSql)
        toast.success("SQL copied to clipboard")
      } catch {
        toast.error("Failed to copy")
      }
    }

    const toastId = toast.loading(
      <div class="flex flex-col gap-1">
        <span>Executing update...</span>
        <button type="button" class="cursor-default text-left text-muted-foreground text-xs">
          {updateSql.length > 50 ? `${updateSql.slice(0, 50)}...` : updateSql}
        </button>
      </div>
    )

    try {
      const res = await honoClient.spacetime.sql.$post({
        json: {
          sql: updateSql,
          database: database()!,
        },
      })
      const data = await res.json()

      if (data.results?.[0]?.success) {
        toast.success(
          <div class="flex flex-col gap-1">
            <span>Row updated successfully</span>
            <Tippy
              content={<code class="whitespace-pre-wrap text-xs">{updateSql}</code>}
              props={{ placement: "bottom", zIndex: 9999999999 }}
            >
              <button
                type="button"
                onClick={copyToClipboard}
                class="cursor-pointer text-left text-muted-foreground text-xs underline decoration-dotted hover:text-foreground"
              >
                {updateSql.length > 50 ? `${updateSql.slice(0, 50)}...` : updateSql}
              </button>
            </Tippy>
          </div>,
          { id: toastId }
        )
      } else {
        const errorMsg = data.results?.[0]?.error || "Update failed"
        toast.error(
          <div class="flex flex-col gap-1">
            <span>{errorMsg}</span>
            <Tippy
              content={<code class="whitespace-pre-wrap text-xs">{updateSql}</code>}
              props={{ placement: "bottom", zIndex: 9999999999 }}
            >
              <button
                type="button"
                onClick={copyToClipboard}
                class="cursor-pointer text-left text-muted-foreground/70 text-xs underline decoration-dotted hover:text-foreground"
              >
                {updateSql.length > 50 ? `${updateSql.slice(0, 50)}...` : updateSql}
              </button>
            </Tippy>
          </div>,
          { id: toastId }
        )
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to execute update"
      toast.error(
        <div class="flex flex-col gap-1">
          <span>{message}</span>
          <Tippy
            content={<code class="whitespace-pre-wrap text-xs">{updateSql}</code>}
            props={{ placement: "bottom", zIndex: 9999999999 }}
          >
            <button
              type="button"
              onClick={copyToClipboard}
              class="cursor-pointer text-left text-muted-foreground/70 text-xs underline decoration-dotted hover:text-foreground"
            >
              {updateSql.length > 50 ? `${updateSql.slice(0, 50)}...` : updateSql}
            </button>
          </Tippy>
        </div>,
        { id: toastId }
      )
    }
  }

  const handleDeleteRow = async (rows: Record<string, unknown>[]) => {
    const table = selectedTable()
    const pkCols = currentPrimaryKeyColumns()
    if (!table || pkCols.length === 0) {
      toast.error("Cannot delete: No primary key found for this table")
      return
    }

    const rowConditions = rows.map((row) =>
      pkCols.length === 1
        ? `${pkCols[0]} = ${formatSqlValue(row[pkCols[0]])}`
        : `(${pkCols.map((col) => `${col} = ${formatSqlValue(row[col])}`).join(" AND ")})`
    )
    const whereClause = rowConditions.join(" OR ")

    const deleteSql = `DELETE FROM ${table} WHERE ${whereClause};`

    const copyToClipboard = async () => {
      try {
        await navigator.clipboard.writeText(deleteSql)
        toast.success("SQL copied to clipboard")
      } catch {
        toast.error("Failed to copy")
      }
    }

    const toastId = toast.loading(
      <div class="flex flex-col gap-1">
        <span>Deleting {rows.length} row{rows.length !== 1 ? "s" : ""}...</span>
        <button type="button" class="cursor-default text-left text-muted-foreground text-xs">
          {deleteSql.length > 50 ? `${deleteSql.slice(0, 50)}...` : deleteSql}
        </button>
      </div>
    )

    try {
      const res = await honoClient.spacetime.sql.$post({
        json: {
          sql: deleteSql,
          database: database()!,
        },
      })
      const data = await res.json()

      if (data.results?.[0]?.success) {
        toast.success(
          <div class="flex flex-col gap-1">
            <span>{rows.length} row{rows.length !== 1 ? "s" : ""} deleted successfully</span>
            <Tippy
              content={<code class="whitespace-pre-wrap text-xs">{deleteSql}</code>}
              props={{ placement: "bottom", zIndex: 9999999999 }}
            >
              <button
                type="button"
                onClick={copyToClipboard}
                class="cursor-pointer text-left text-muted-foreground text-xs underline decoration-dotted hover:text-foreground"
              >
                {deleteSql.length > 50 ? `${deleteSql.slice(0, 50)}...` : deleteSql}
              </button>
            </Tippy>
          </div>,
          { id: toastId }
        )
      } else {
        const errorMsg = data.results?.[0]?.error || "Delete failed"
        toast.error(
          <div class="flex flex-col gap-1">
            <span>{errorMsg}</span>
            <Tippy
              content={<code class="whitespace-pre-wrap text-xs">{deleteSql}</code>}
              props={{ placement: "bottom", zIndex: 9999999999 }}
            >
              <button
                type="button"
                onClick={copyToClipboard}
                class="cursor-pointer text-left text-muted-foreground/70 text-xs underline decoration-dotted hover:text-foreground"
              >
                {deleteSql.length > 50 ? `${deleteSql.slice(0, 50)}...` : deleteSql}
              </button>
            </Tippy>
          </div>,
          { id: toastId }
        )
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to execute delete"
      toast.error(
        <div class="flex flex-col gap-1">
          <span>{message}</span>
          <Tippy
            content={<code class="whitespace-pre-wrap text-xs">{deleteSql}</code>}
            props={{ placement: "bottom", zIndex: 9999999999 }}
          >
            <button
              type="button"
              onClick={copyToClipboard}
              class="cursor-pointer text-left text-muted-foreground/70 text-xs underline decoration-dotted hover:text-foreground"
            >
              {deleteSql.length > 50 ? `${deleteSql.slice(0, 50)}...` : deleteSql}
            </button>
          </Tippy>
        </div>,
        { id: toastId }
      )
    }
  }

  return (
    <div class="flex h-full flex-col overflow-hidden bg-background">
      <PageHeader
        title={selectedTable() || "Tables"}
        database={database()}
        loading={loading()}
        onDatabaseChange={handleDatabaseChange}
      />

      <main class="flex-1 overflow-hidden p-4">
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
          <div class="flex h-full flex-col overflow-hidden">
            <Show when={isRealTime()}>
              <div class="mb-3 flex shrink-0 items-center gap-1.5 rounded bg-green-500/10 px-2 py-1 text-green-600 text-xs dark:bg-green-500/20 dark:text-green-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                >
                  <path d="M5 15h1.394c.786 0 1.18 0 1.511.177c.332.178.55.505.986 1.159l.16.24c.422.633.633.95.92.933c.286-.017.459-.356.803-1.036l1.966-3.877c.359-.706.538-1.06.831-1.071c.293-.012.5.326.914 1.001l.637 1.04c.43.701.644 1.051.985 1.243c.342.19.752.19 1.573.19H19" />
                  <path d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12Z" />
                </svg>
                <span>Real-time sync enabled</span>
              </div>
            </Show>

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
              <Card class="flex-1">
                <CardContent class="flex h-full items-center justify-center py-8">
                  <div class="text-center text-muted-foreground">Loading table data...</div>
                </CardContent>
              </Card>
            </Show>

            <Show when={queryResult() && !queryLoading()}>
              <Card class="flex min-h-0 flex-1 flex-col overflow-hidden">
                <CardContent class="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                  <DataTable
                    columns={queryResult()?.columns ?? []}
                    rows={queryResult()?.rows ?? []}
                    tableName={selectedTable()}
                    primaryKeyColumns={currentPrimaryKeyColumns()}
                    onSave={handleCellSave}
                    onDeleteRow={handleDeleteRow}
                    class="flex-1"
                  />
                  <Show when={(queryResult()?.rows?.length ?? 0) > 0}>
                    <div class="shrink-0 border-border border-t px-4 py-2 text-muted-foreground text-xs">
                      {queryResult()?.rows?.length ?? 0} rows
                      <Show when={isRealTime()}>
                        <span class="ml-2 inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                          <span class="relative flex size-1.5">
                            <span class="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-75" />
                            <span class="relative inline-flex size-1.5 rounded-full bg-green-500" />
                          </span>
                          live
                        </span>
                      </Show>
                    </div>
                  </Show>
                </CardContent>
              </Card>
            </Show>
          </div>
        </Show>
      </main>
    </div>
  )
}
