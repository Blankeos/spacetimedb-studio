import { createContext, useContext } from "solid-js"

export function createStrictContext<T>(name: string) {
  const Context = createContext<T>(null as unknown as T)

  function useStrictContext() {
    const ctx = useContext(Context)
    if (!ctx) throw new Error(`${name} must be used within its provider`)
    return ctx
  }

  return [useStrictContext, Context.Provider] as const
}
