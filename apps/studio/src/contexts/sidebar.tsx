import { useLocalStorage } from "bagon-hooks"
import { createContext, type FlowProps, useContext } from "solid-js"

const COLLAPSED_KEY = "sidebar-collapsed"

type SidebarContextValue = {
  isCollapsed: () => boolean
  toggle: () => void
  collapse: () => void
  expand: () => void
}

const SidebarContext = createContext<SidebarContextValue>()

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider")
  return ctx
}

export function SidebarProvider(props: FlowProps) {
  const [isCollapsed, setIsCollapsed] = useLocalStorage({
    key: COLLAPSED_KEY,
    defaultValue: false,
  })

  const toggle = () => setIsCollapsed(!isCollapsed())
  const collapse = () => setIsCollapsed(true)
  const expand = () => setIsCollapsed(false)

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed: () => isCollapsed(),
        toggle,
        collapse,
        expand,
      }}
    >
      {props.children}
    </SidebarContext.Provider>
  )
}
