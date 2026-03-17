import { createEffect, createSignal } from "solid-js"
import { honoClient } from "@/lib/hono-client"

interface TableSchema {
  name: string
  primaryKeyColumns: string[]
}

export function useTableSchemas(database: () => string | undefined) {
  const [tableSchemas, setTableSchemas] = createSignal<Map<string, TableSchema>>(new Map())

  createEffect(() => {
    const db = database()
    if (!db) {
      setTableSchemas(new Map())
      return
    }

    honoClient.spacetime.describe
      .$get({ query: { db } })
      .then((res) => res.json())
      .then((data) => {
        if (!data.success || !data.data) return

        const schemas = new Map<string, TableSchema>()
        const types = data.data.typespace.types
        for (const table of data.data.tables) {
          const pkIndices = table.primary_key as number[]
          const typeRef = table.product_type_ref as number
          const productType = types[typeRef] as
            | { Product: { elements: Array<{ name?: { some: string } }> } }
            | undefined
          const elements = productType?.Product?.elements ?? []
          const pkCols = pkIndices
            .map((idx) => elements[idx]?.name?.some)
            .filter((name): name is string => typeof name === "string")
          schemas.set(table.name, {
            name: table.name,
            primaryKeyColumns: pkCols,
          })
        }
        setTableSchemas(schemas)
      })
      .catch(() => {})
  })

  return tableSchemas
}
