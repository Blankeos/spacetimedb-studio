import { type Component, type ComponentProps, type JSX, splitProps } from "solid-js"
import { useSidebar } from "@/contexts/sidebar"
import { Tippy } from "@/lib/solid-tippy/tippy"
import { cn } from "@/utils/cn"

export const Sidebar: Component<ComponentProps<"aside">> = (props) => {
  const [local, others] = splitProps(props, ["class", "children"])
  const { isCollapsed } = useSidebar()

  return (
    <aside
      class={cn(
        "flex h-full shrink-0 flex-col border-border border-r bg-background font-mono transition-all duration-200",
        isCollapsed() ? "w-12" : "w-56",
        local.class
      )}
      {...others}
    >
      {local.children}
    </aside>
  )
}

export interface SidebarHeaderProps extends ComponentProps<"div"> {}

export const SidebarHeader: Component<SidebarHeaderProps> = (props) => {
  const [local, others] = splitProps(props, ["class", "children"])
  const { isCollapsed } = useSidebar()

  return (
    <div
      class={cn(
        "flex items-center gap-3 border-border border-b px-4 py-3",
        isCollapsed() && "justify-center px-2",
        local.class
      )}
      {...others}
    >
      {local.children}
    </div>
  )
}

export interface SidebarContentProps extends ComponentProps<"div"> {}

export const SidebarContent: Component<SidebarContentProps> = (props) => {
  const [local, others] = splitProps(props, ["class", "children"])
  return (
    <div class={cn("flex-1 overflow-auto py-2", local.class)} {...others}>
      {local.children}
    </div>
  )
}

export interface SidebarItemProps {
  active?: boolean
  icon?: (props: { class?: string }) => JSX.Element
  href?: string
  target?: string
  class?: string
  children?: JSX.Element
  onClick?: () => void
}

export const SidebarItem: Component<SidebarItemProps> = (props) => {
  const [local] = splitProps(props, [
    "class",
    "active",
    "icon",
    "children",
    "href",
    "onClick",
    "target",
  ])
  const { isCollapsed } = useSidebar()

  return (
    <a
      href={local.href}
      target={local.target}
      class={cn(
        "flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        local.active
          ? "border-l-2 border-l-primary bg-accent text-accent-foreground"
          : "border-l-2 border-l-transparent text-muted-foreground",
        isCollapsed() && "justify-center px-2",
        local.class
      )}
      onClick={local.onClick}
    >
      {local.icon && <local.icon class="size-4 shrink-0" />}
      {!isCollapsed() && <span class="truncate">{local.children}</span>}
    </a>
  )
}

export interface SidebarGroupProps extends ComponentProps<"div"> {
  label?: string
}

export const SidebarGroup: Component<SidebarGroupProps> = (props) => {
  const [local, others] = splitProps(props, ["class", "label", "children"])
  const { isCollapsed } = useSidebar()

  return (
    <div class={cn("py-1", local.class)} {...others}>
      {local.label && (
        <Tippy content={local.label} disabled={!isCollapsed()} props={{ placement: "right" }}>
          <div
            class={cn(
              "px-4 py-1.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider",
              isCollapsed() && "text-center"
            )}
          >
            {isCollapsed() ? local.label[0] : local.label}
          </div>
        </Tippy>
      )}
      {local.children}
    </div>
  )
}

export interface SidebarFooterProps extends ComponentProps<"div"> {}

export const SidebarFooter: Component<SidebarFooterProps> = (props) => {
  const [local, others] = splitProps(props, ["class", "children"])
  const { isCollapsed } = useSidebar()

  return (
    <div class={cn("border-border border-t p-4", isCollapsed() && "p-2", local.class)} {...others}>
      {local.children}
    </div>
  )
}

export interface SidebarTooltipItemProps {
  active?: boolean
  icon: (props: { class?: string }) => JSX.Element
  label: string
  href?: string
  target?: string
  class?: string
  onClick?: () => void
  external?: boolean
  tooltipContent?: JSX.Element
}

const ArrowUpRightIcon = (props: { class?: string }) => (
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
    <path d="M7 17L17 7" />
    <path d="M7 7h10v10" />
  </svg>
)

export const SidebarTooltipItem: Component<SidebarTooltipItemProps> = (props) => {
  const [local] = splitProps(props, [
    "active",
    "icon",
    "label",
    "href",
    "target",
    "class",
    "onClick",
    "external",
    "tooltipContent",
  ])
  const { isCollapsed } = useSidebar()

  const tooltipLabel = () =>
    local.tooltipContent ??
    (local.external ? (
      <span class="flex items-center gap-1.5">
        {local.label}
        <ArrowUpRightIcon class="size-3" />
      </span>
    ) : (
      local.label
    ))

  return (
    <Tippy content={tooltipLabel()} disabled={!isCollapsed()} props={{ placement: "right" }}>
      <a
        href={local.href}
        target={local.target}
        class={cn(
          "flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          local.active
            ? "border-l-2 border-l-primary bg-accent text-accent-foreground"
            : "border-l-2 border-l-transparent text-muted-foreground",
          isCollapsed() && "justify-center px-2",
          local.class
        )}
        onClick={local.onClick}
      >
        <local.icon class="size-4 shrink-0" />
        {!isCollapsed() && (
          <>
            <span class="flex-1 truncate">{local.label}</span>
            {local.external && <ArrowUpRightIcon class="size-3 shrink-0 text-muted-foreground" />}
          </>
        )}
      </a>
    </Tippy>
  )
}
