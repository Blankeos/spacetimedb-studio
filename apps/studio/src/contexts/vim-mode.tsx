import { useLocalStorage } from "bagon-hooks"
import type { Accessor, FlowComponent, Setter } from "solid-js"
import { createStrictContext } from "@/utils/create-strict-context"

export type VimModeContextValue = {
  vimModeEnabled: Accessor<boolean>
  setVimModeEnabled: Setter<boolean>
  toggleVimMode: () => void
}

const [useVimModeContext, VimModeContextProvider] =
  createStrictContext<VimModeContextValue>("VimModeContext")

export { useVimModeContext }

export const VimModeProvider: FlowComponent = (props) => {
  const [vimModeEnabled, setVimModeEnabled] = useLocalStorage<boolean>({
    key: "vimModeEnabled",
    defaultValue: false,
  })

  function toggleVimMode() {
    setVimModeEnabled(!vimModeEnabled())
  }

  return (
    <VimModeContextProvider
      value={{
        vimModeEnabled,
        setVimModeEnabled,
        toggleVimMode,
      }}
    >
      {props.children}
    </VimModeContextProvider>
  )
}
