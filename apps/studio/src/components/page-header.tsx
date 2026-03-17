import { createEffect, createSignal, type JSX, Show } from "solid-js"

interface PageHeaderProps {
  title: string
  database: string | null
  loading: boolean
  onDatabaseChange: (db: string) => void
  children?: JSX.Element
}

export function PageHeader(props: PageHeaderProps) {
  const [editingDatabase, setEditingDatabase] = createSignal(false)

  createEffect(() => {
    if (props.database && editingDatabase()) {
      setEditingDatabase(false)
    }
  })

  return (
    <header class="flex h-[50px] shrink-0 items-center justify-between border-border border-b bg-card px-4 py-2">
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2">
          <Show when={props.loading}>
            <div class="size-2 animate-pulse bg-muted-foreground/50" />
            <span class="font-mono text-muted-foreground text-xs">Loading...</span>
          </Show>
          <Show when={!props.loading}>
            <div class={`size-2 ${props.database ? "bg-emerald-500" : "bg-red-500"} `} />
            <Show
              when={!props.database && editingDatabase()}
              fallback={
                <button
                  type="button"
                  class="max-w-[160px] truncate font-medium font-mono text-foreground text-xs hover:underline"
                  title={props.database || "No database selected"}
                  onClick={() => !props.database && setEditingDatabase(true)}
                >
                  {props.database || "No database selected"}
                </button>
              }
            >
              <input
                type="text"
                placeholder="Enter database name"
                class="bg-transparent px-0 py-0.5 font-mono text-xs outline-none focus:border-primary focus:outline-none focus:ring-0"
                onBlur={(e) => {
                  const value = e.currentTarget.value.trim()
                  if (value) {
                    props.onDatabaseChange(value)
                  }
                  setEditingDatabase(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const value = e.currentTarget.value.trim()
                    if (value) {
                      props.onDatabaseChange(value)
                    }
                    setEditingDatabase(false)
                  }
                  if (e.key === "Escape") {
                    setEditingDatabase(false)
                  }
                }}
                autofocus
              />
            </Show>
          </Show>
        </div>
        <div class="h-4 w-px bg-border" />
        <span class="text-muted-foreground text-xs">{props.title}</span>
      </div>
      {props.children}
    </header>
  )
}
