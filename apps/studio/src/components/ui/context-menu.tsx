import * as ContextMenuPrimitive from "@kobalte/core/context-menu"
import type { PolymorphicProps } from "@kobalte/core/polymorphic"
import type { Component, ComponentProps, JSX, ValidComponent } from "solid-js"
import { splitProps } from "solid-js"

import { cn } from "@/utils/cn"

const ContextMenuTrigger = ContextMenuPrimitive.Trigger
const ContextMenuPortal = ContextMenuPrimitive.Portal
const ContextMenuSub = ContextMenuPrimitive.Sub
const ContextMenuGroup = ContextMenuPrimitive.Group
const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup

const ContextMenu: Component<ContextMenuPrimitive.ContextMenuRootProps> = (props) => {
  return <ContextMenuPrimitive.Root gutter={4} {...props} />
}

type ContextMenuContentProps<T extends ValidComponent = "div"> =
  ContextMenuPrimitive.ContextMenuContentProps<T> & {
    class?: string | undefined
  }

const ContextMenuContent = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, ContextMenuContentProps<T>>
) => {
  const [local, others] = splitProps(props as ContextMenuContentProps, ["class"])
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        class={cn(
          "z-50 min-w-32 origin-[var(--kb-menu-content-transform-origin)] animate-fadeOut overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none [animation-duration:80ms] data-expanded:animate-fadeIn",
          local.class
        )}
        {...others}
      />
    </ContextMenuPrimitive.Portal>
  )
}

type ContextMenuItemProps<T extends ValidComponent = "div"> =
  ContextMenuPrimitive.ContextMenuItemProps<T> & {
    class?: string | undefined
  }

const ContextMenuItem = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, ContextMenuItemProps<T>>
) => {
  const [local, others] = splitProps(props as ContextMenuItemProps, ["class"])
  return (
    <ContextMenuPrimitive.Item
      class={cn(
        "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        local.class
      )}
      {...others}
    />
  )
}

const ContextMenuShortcut: Component<ComponentProps<"span">> = (props) => {
  const [local, others] = splitProps(props, ["class"])
  return <span class={cn("ml-auto text-xs tracking-widest opacity-60", local.class)} {...others} />
}

type ContextMenuSeparatorProps<T extends ValidComponent = "hr"> =
  ContextMenuPrimitive.ContextMenuSeparatorProps<T> & {
    class?: string | undefined
  }

const ContextMenuSeparator = <T extends ValidComponent = "hr">(
  props: PolymorphicProps<T, ContextMenuSeparatorProps<T>>
) => {
  const [local, others] = splitProps(props as ContextMenuSeparatorProps, ["class"])
  return (
    <ContextMenuPrimitive.Separator
      class={cn("-mx-1 my-1 h-px bg-muted", local.class)}
      {...others}
    />
  )
}

export {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRadioGroup,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuTrigger,
}
