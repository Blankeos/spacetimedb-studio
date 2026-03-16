import { createSignal, onMount } from "solid-js"

export function useSessionStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = createSignal<T>(initialValue)
  const [isInitialized, setIsInitialized] = createSignal(false)

  onMount(() => {
    try {
      const item = sessionStorage.getItem(key)
      if (item) {
        setStoredValue(() => JSON.parse(item) as T)
      }
    } catch (error) {
      console.error(`Error reading sessionStorage key "${key}":`, error)
    }
    setIsInitialized(true)
  })

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue() as T) : value
      setStoredValue(() => valueToStore)
      if (typeof window !== "undefined") {
        sessionStorage.setItem(key, JSON.stringify(valueToStore))
      }
    } catch (error) {
      console.error(`Error setting sessionStorage key "${key}":`, error)
    }
  }

  return [storedValue, setValue, isInitialized] as const
}
