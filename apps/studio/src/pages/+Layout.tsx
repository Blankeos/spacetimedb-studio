import { type FlowProps } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import "@/styles/app.css"
import getTitle from "@/utils/get-title"

useMetadata.setGlobalDefaults({
  title: getTitle("SQL Editor"),
  description: "SpacetimeDB Studio - SQL Editor with vim mode support",
})

export default function RootLayout(props: FlowProps) {
  return (
    <div class="min-h-screen bg-background text-foreground flex flex-col">
      {props.children}
    </div>
  )
}
