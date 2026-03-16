import { useLocalStorage } from "bagon-hooks"
import {
  type Accessor,
  createEffect,
  createSignal,
  type FlowComponent,
  type Setter,
} from "solid-js"
import { createStrictContext } from "@/utils/create-strict-context"

export const themeInitScript = `
(function() {
  const themes = ["light", "dark"]
  const themeKey = "app-theme"
  let savedTheme = null
  try {
    savedTheme = JSON.parse(localStorage.getItem(themeKey) || 'null')
  } catch (e) {
    savedTheme = null
  }
  const theme = savedTheme && themes.includes(savedTheme) ? savedTheme :
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"

  themes.forEach(function(t) {
    if (t === theme) {
      document.documentElement.classList.add(t)
    } else {
      document.documentElement.classList.remove(t)
    }
  })
})()
`

export const themes = ["light", "dark", "system"] as const

export type Theme = (typeof themes)[number]

export type ThemeContextValue = {
  theme: Accessor<Theme>
  setTheme: Setter<Theme>
  inferredTheme: Accessor<Exclude<Theme, "system">>
}

const [useThemeContext, ThemeContextProvider] =
  createStrictContext<ThemeContextValue>("ThemeContext")

export { useThemeContext }

export const ThemeProvider: FlowComponent = (props) => {
  const [theme, setTheme] = useLocalStorage<Theme>({
    key: "app-theme",
    defaultValue: "system",
  })

  const [inferredTheme, setInferredTheme] =
    createSignal<ReturnType<ThemeContextValue["inferredTheme"]>>("light")

  createEffect(() => {
    let themeValue = theme()

    if (themeValue === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      themeValue = prefersDark ? "dark" : "light"
    }

    themes.forEach((themeName) => {
      if (themeName === "system") return
      if (themeValue === themeName) {
        document.documentElement.classList.add(themeName)
      } else {
        document.documentElement.classList.remove(themeName)
      }
    })

    setInferredTheme(themeValue as "light" | "dark")
  })

  return (
    <ThemeContextProvider
      value={{
        theme,
        setTheme,
        inferredTheme,
      }}
    >
      {props.children}
    </ThemeContextProvider>
  )
}
