import * as TabsPrimitive from "@kobalte/core/tabs"
import type { Component, ComponentProps, JSX } from "solid-js"
import { splitProps } from "solid-js"
import { cn } from "@/utils/cn"

const Tabs = TabsPrimitive.Root

const TabsList: Component<ComponentProps<"div">> = (props) => {
  const [local, others] = splitProps(props, ["class"])
  return (
    <TabsPrimitive.List
      class={cn(
        "inline-flex h-8 items-center justify-center border-border border-b bg-muted/20 p-0",
        local.class
      )}
      {...others}
    />
  )
}

type TabsTriggerProps = {
  value: string
  class?: string
  children?: JSX.Element
}

const TabsTrigger: Component<TabsTriggerProps> = (props) => {
  return (
    <TabsPrimitive.Trigger
      value={props.value}
      class={cn(
        "inline-flex items-center justify-center whitespace-nowrap border-transparent border-b-2 px-3 py-1.5 font-medium text-muted-foreground text-xs ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[selected]:border-primary data-[selected]:text-foreground",
        props.class
      )}
    >
      {props.children}
    </TabsPrimitive.Trigger>
  )
}

const TabsContent: Component<ComponentProps<"div"> & { value: string }> = (props) => {
  const [local, others] = splitProps(props, ["class", "value", "children"])
  return (
    <TabsPrimitive.Content
      value={local.value}
      class={cn(
        "mt-0 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        local.class
      )}
      {...others}
    >
      {local.children}
    </TabsPrimitive.Content>
  )
}

const TabsIndicator: Component<ComponentProps<"div">> = (props) => {
  const [local, others] = splitProps(props, ["class"])
  return (
    <TabsPrimitive.Indicator
      class={cn(
        "absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-200",
        local.class
      )}
      {...others}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, TabsIndicator }
