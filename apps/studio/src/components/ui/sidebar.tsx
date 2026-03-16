import { type Component, type ComponentProps, type JSX, splitProps } from "solid-js"
import { cn } from "@/utils/cn"

export interface SidebarProps extends ComponentProps<"aside"> {
  collapsed?: boolean
}

export const Sidebar: Component<SidebarProps> = (props) => {
  const [local, others] = splitProps(props, ["class", "collapsed", "children"])

  return (
    <aside
      class={cn(
        "flex h-full shrink-0 flex-col border-border border-r bg-background",
        local.collapsed ? "w-12" : "w-56",
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
  return (
    <div
      class={cn("flex items-center gap-3 border-border border-b px-4 py-3", local.class)}
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
  class?: string
  children?: JSX.Element
  onClick?: () => void
}

export const SidebarItem: Component<SidebarItemProps> = (props) => {
  const [local, others] = splitProps(props, ["class", "active", "icon", "children", "href", "onClick"])
  const Icon = local.icon

  const className = cn(
    "flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors",
    "hover:bg-accent hover:text-accent-foreground",
    local.active
      ? "border-l-2 border-l-primary bg-accent text-accent-foreground"
      : "border-l-2 border-l-transparent text-muted-foreground",
    local.class
  )

  if (local.href) {
    return (
      <a href={local.href} class={className}>
        {Icon && <Icon class="size-4 shrink-0" />}
        <span class="truncate">{local.children}</span>
      </a>
    )
  }

  return (
    <button type="button" class={className} onClick={local.onClick}>
      {Icon && <Icon class="size-4 shrink-0" />}
      <span class="truncate">{local.children}</span>
    </button>
  )
}

export interface SidebarGroupProps extends ComponentProps<"div"> {
  label?: string
}

export const SidebarGroup: Component<SidebarGroupProps> = (props) => {
  const [local, others] = splitProps(props, ["class", "label", "children"])
  return (
    <div class={cn("py-1", local.class)} {...others}>
      {local.label && (
        <div class="px-4 py-1.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
          {local.label}
        </div>
      )}
      {local.children}
    </div>
  )
}

export interface SidebarFooterProps extends ComponentProps<"div"> {}

export const SidebarFooter: Component<SidebarFooterProps> = (props) => {
  const [local, others] = splitProps(props, ["class", "children"])
  return (
    <div class={cn("border-border border-t p-4", local.class)} {...others}>
      {local.children}
    </div>
  )
}
