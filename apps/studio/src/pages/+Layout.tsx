import { createEffect, createSignal, type FlowProps, For, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import { Toaster } from "solid-sonner"
import "@/styles/app.css"
import "@/lib/solid-tippy/tippy.css"
import { openSettingsPalette, SettingsCommandPalette } from "@/components/settings-command-palette"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarTooltipItem,
} from "@/components/ui/sidebar"
import { DatabaseProvider, useDatabase } from "@/contexts/database"
import { SidebarProvider, useSidebar } from "@/contexts/sidebar"
import { SpacetimeProvider } from "@/contexts/spacetime"
import { ThemeProvider, themeInitScript, useThemeContext } from "@/contexts/theme"
import { VimModeProvider } from "@/contexts/vim-mode"
import {
  DocumentationIcon,
  FileJsonIcon,
  SettingsIcon,
  SpacetimeLogoIcon,
  SqlIcon,
  TableIcon,
} from "@/icons/sidebar-icons"
import { honoClient } from "@/lib/hono-client"
import { Tippy } from "@/lib/solid-tippy/tippy"
import { getRoute } from "@/route-tree.gen"
import { cn } from "@/utils/cn"
import getTitle from "@/utils/get-title"
import { isLinkActive } from "@/utils/is-link-active"

useMetadata.setGlobalDefaults({
  title: getTitle("SQL Editor"),
  description: "SpacetimeDB Studio - SQL Editor with vim mode support",
  otherJSX: () => {
    return (
      <>
        <link rel="icon" type="image/svg+xml" href="/icon-logo-dark.svg" class="icon-dark" />
        <link rel="icon" type="image/svg+xml" href="/icon-logo-light.svg" class="icon-light" />
      </>
    )
  },
})

const SearchIcon = (props: { class?: string }) => (
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
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
)

const CollapseIcon = () => (
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
    <path d="m11 17-5-5 5-5" />
    <path d="m18 17-5-5 5-5" />
  </svg>
)

const ExpandIcon = () => (
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
    <path d="m13 17 5-5-5-5" />
    <path d="m6 17 5-5-5-5" />
  </svg>
)

export interface TableInfo {
  name: string
  rowCount: number | null
  type: "user" | "system"
}

const formatRowCount = (count: number | null) => {
  if (count === null) return "—"
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return count.toString()
}

function SidebarContentWithTables() {
  const { database, selectedTable, setSelectedTable } = useDatabase()
  const { isCollapsed, toggle } = useSidebar()
  const pageContext = usePageContext()
  const [tables, setTables] = createSignal<TableInfo[]>([])
  const [tablesLoading, setTablesLoading] = createSignal(false)
  const [searchQuery, setSearchQuery] = createSignal("")

  const currentPath = () => pageContext.urlPathname
  const isOnRoot = () => isLinkActive(getRoute("/"), currentPath(), 1)
  const isOnTablesPage = () => isLinkActive(getRoute("/tables"), currentPath(), 1)
  const isOnSchemas = () => isLinkActive(getRoute("/schemas"), currentPath(), 1)

  createEffect(() => {
    const db = database()
    if (!db) return

    setTablesLoading(true)
    honoClient.spacetime.tables
      .$get({ query: { db } })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setTables(() => data.data)
        }
      })
      .finally(() => setTablesLoading(false))
  })

  const filteredTables = () => {
    const query = searchQuery().toLowerCase()
    if (!query) return tables()
    return tables().filter((t) => t.name.toLowerCase().includes(query))
  }

  const userTables = () => filteredTables().filter((t) => t.type === "user")
  const systemTables = () => filteredTables().filter((t) => t.type === "system")

  return (
    <>
      <SidebarHeader>
        <Show when={!isCollapsed()}>
          <SpacetimeLogoIcon class="size-5 shrink-0 text-foreground" />
          <span class="font-mono font-semibold text-sm">SpacetimeDB</span>
        </Show>
        <Tippy
          content={isCollapsed() ? "Expand" : "Collapse"}
          props={{ placement: isCollapsed() ? "right" : "bottom" }}
        >
          <Button
            variant="ghost"
            size="icon"
            class={cn("size-6 p-0", !isCollapsed() && "ml-auto")}
            onClick={() => toggle()}
          >
            <Show when={isCollapsed()} fallback={<CollapseIcon />}>
              <ExpandIcon />
            </Show>
          </Button>
        </Tippy>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup label="Workspace">
          <SidebarTooltipItem href="/" icon={SqlIcon} label="SQL Editor" active={isOnRoot()} />
          <SidebarTooltipItem
            href="/tables"
            icon={TableIcon}
            label="Tables"
            active={isOnTablesPage()}
          />
          <SidebarTooltipItem
            href="/schemas"
            icon={FileJsonIcon}
            label="Schemas"
            active={isOnSchemas()}
          />
        </SidebarGroup>

        <SidebarGroup label="Resources">
          <SidebarTooltipItem
            icon={DocumentationIcon}
            label="Documentation"
            href="https://spacetimedb.com/docs/"
            target="_blank"
            external
          />
        </SidebarGroup>

        <Show when={isOnTablesPage() && !isCollapsed()}>
          <div class="mt-2 border-border border-t px-4 py-2">
            <div class="mb-2 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
              Tables
            </div>
            <div class="relative mb-2">
              <SearchIcon class="absolute top-1/2 left-2.5 size-3 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search tables..."
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                class="w-full border border-border bg-muted/30 px-7 py-1.5 text-xs outline-none focus:border-primary focus:ring-0"
              />
            </div>

            <Show when={tablesLoading()}>
              <div class="py-4 text-center text-muted-foreground text-xs">Loading tables...</div>
            </Show>

            <Show when={!tablesLoading() && userTables().length > 0}>
              <div class="mb-1 text-[9px] text-muted-foreground/70 uppercase tracking-wider">
                User Tables
              </div>
              <div class="mb-2 space-y-0.5">
                <For each={userTables()}>
                  {(table) => (
                    <button
                      type="button"
                      onClick={() => setSelectedTable(table.name)}
                      class={cn(
                        "flex w-full items-center justify-between px-2 py-1.5 text-left text-xs transition-colors",
                        selectedTable() === table.name
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
                      )}
                    >
                      <TableIcon class="mr-2 size-3 shrink-0" />
                      <span class="flex-1 truncate">{table.name}</span>
                      <span class="ml-2 shrink-0 font-mono text-[10px] text-muted-foreground">
                        {formatRowCount(table.rowCount)}
                      </span>
                    </button>
                  )}
                </For>
              </div>
            </Show>

            <Show when={!tablesLoading() && systemTables().length > 0}>
              <div class="mb-1 text-[9px] text-muted-foreground/70 uppercase tracking-wider">
                System Tables
              </div>
              <div class="space-y-0.5">
                <For each={systemTables()}>
                  {(table) => (
                    <button
                      type="button"
                      onClick={() => setSelectedTable(table.name)}
                      class={cn(
                        "flex w-full items-center justify-between px-2 py-1.5 text-left text-xs transition-colors",
                        selectedTable() === table.name
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
                      )}
                    >
                      <TableIcon class="mr-2 size-3 shrink-0" />
                      <span class="flex-1 truncate">{table.name}</span>
                      <span class="ml-2 shrink-0 font-mono text-[10px] text-muted-foreground">
                        {formatRowCount(table.rowCount)}
                      </span>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>
      </SidebarContent>

      <SidebarFooter>
        <Tippy
          content={
            <span class="flex items-center gap-2">
              Settings{" "}
              <kbd class="inline-flex items-center gap-0.5 rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] leading-none">
                <span>⌘</span>
                <span>K</span>
              </kbd>
            </span>
          }
          props={{ placement: isCollapsed() ? "right" : "bottom" }}
        >
          <button
            type="button"
            class={cn(
              "flex w-full items-center text-left text-muted-foreground text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
              isCollapsed() ? "justify-center px-2 py-2" : "gap-3 px-4 py-2"
            )}
            onClick={openSettingsPalette}
          >
            <SettingsIcon class="size-4 shrink-0" />
            <Show when={!isCollapsed()}>
              <span class="truncate">Settings</span>
            </Show>
          </button>
        </Tippy>
      </SidebarFooter>
    </>
  )
}

function DatabaseInitializer(props: { children: unknown }) {
  const { database, setDatabase, loading } = useDatabase()

  createEffect(() => {
    if (!loading() && database()) {
      return
    }

    const urlDb = new URLSearchParams(window.location.search).get("db")
    if (urlDb) {
      setDatabase(urlDb)
      return
    }

    if (!database()) {
      honoClient.spacetime.config
        .$get()
        .then((res) => res.json())
        .then((data) => {
          if (data.database) {
            setDatabase(data.database)
          }
        })
    }
  })

  return <>{props.children}</>
}

function ToastProvider() {
  const { inferredTheme } = useThemeContext()
  return <Toaster theme={inferredTheme()} richColors />
}

export default function RootLayout(props: FlowProps) {
  return (
    <>
      <script innerHTML={themeInitScript} />
      <ThemeProvider>
        <VimModeProvider>
          <DatabaseProvider>
            <SpacetimeProvider>
              <SidebarProvider>
                <DatabaseInitializer>
                  <div class="flex h-screen overflow-hidden bg-background text-foreground">
                    <Sidebar>
                      <SidebarContentWithTables />
                    </Sidebar>

                    <div class="flex min-w-0 flex-1 flex-col">{props.children}</div>
                  </div>
                  <SettingsCommandPalette />
                </DatabaseInitializer>
              </SidebarProvider>
            </SpacetimeProvider>
          </DatabaseProvider>
        </VimModeProvider>
        <ToastProvider />
      </ThemeProvider>
    </>
  )
}
