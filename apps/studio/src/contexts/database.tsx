import { createContext, createSignal, type JSX, onMount, useContext } from "solid-js"

interface DatabaseContextValue {
  database: () => string | null
  setDatabase: (value: string | null | ((prev: string | null) => string | null)) => void
  loading: () => boolean
  selectedTable: () => string | null
  setSelectedTable: (value: string | null) => void
}

const DatabaseContext = createContext<DatabaseContextValue>()

function getFromSessionStorage(key: string): string | null {
  if (typeof window === "undefined") return null
  try {
    const item = sessionStorage.getItem(key)
    return item ? JSON.parse(item) : null
  } catch {
    return null
  }
}

function setToSessionStorage(key: string, value: string | null) {
  if (typeof window === "undefined") return
  try {
    if (value === null) {
      sessionStorage.removeItem(key)
    } else {
      sessionStorage.setItem(key, JSON.stringify(value))
    }
  } catch {
    // Ignore sessionStorage errors
  }
}

export function DatabaseProvider(props: { children: JSX.Element }) {
  const [database, setDatabaseInternal] = createSignal<string | null>(null)
  const [loading, setLoading] = createSignal(true)
  const [selectedTable, setSelectedTable] = createSignal<string | null>(null)

  const setDatabase = (value: string | null | ((prev: string | null) => string | null)) => {
    setDatabaseInternal((prev) => {
      const newValue = typeof value === "function" ? value(prev) : value
      setToSessionStorage("spacetime-db", newValue)
      return newValue
    })
  }

  onMount(() => {
    const stored = getFromSessionStorage("spacetime-db")
    if (stored) {
      setDatabaseInternal(stored)
    }
    setLoading(false)
  })

  return (
    <DatabaseContext.Provider
      value={{ database, setDatabase, loading, selectedTable, setSelectedTable }}
    >
      {props.children}
    </DatabaseContext.Provider>
  )
}

export function useDatabase() {
  const ctx = useContext(DatabaseContext)
  if (!ctx) throw new Error("useDatabase must be used within DatabaseProvider")
  return ctx
}
