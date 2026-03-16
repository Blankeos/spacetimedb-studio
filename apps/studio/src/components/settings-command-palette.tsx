import { useHotkeys } from "bagon-hooks"
import { createSignal, onCleanup, onMount, Show } from "solid-js"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { type Theme, useThemeContext } from "@/contexts/theme"
import { useVimModeContext } from "@/contexts/vim-mode"

const [open, setOpen] = createSignal(false)

export function openSettingsPalette() {
  setOpen(true)
}

function ThemeIcon(props: { theme: Theme }) {
  const { theme } = useThemeContext()
  const current = () => theme() === props.theme
  return (
    <div
      class={`size-4 rounded-full border ${current() ? "border-primary bg-primary" : "border-muted-foreground/30 bg-muted"}`}
    />
  )
}

export function SettingsCommandPalette() {
  const { theme, setTheme } = useThemeContext()
  const { vimModeEnabled, toggleVimMode } = useVimModeContext()

  useHotkeys([["meta+k", () => setOpen(!open())]], [])

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        e.stopPropagation()
        setOpen((prev) => !prev)
      }
    }

    window.addEventListener("keydown", handleKeyDown, true)

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown, true)
    })
  })

  return (
    <CommandDialog open={open()} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Theme">
          <CommandItem
            onSelect={() => {
              setTheme("light")
            }}
            class="flex items-center justify-between"
          >
            <div class="flex items-center gap-2">
              <ThemeIcon theme="light" />
              <span>Light</span>
            </div>
            <Show when={theme() === "light"}>
              <span class="text-muted-foreground text-xs">Active</span>
            </Show>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setTheme("dark")
            }}
            class="flex items-center justify-between"
          >
            <div class="flex items-center gap-2">
              <ThemeIcon theme="dark" />
              <span>Dark</span>
            </div>
            <Show when={theme() === "dark"}>
              <span class="text-muted-foreground text-xs">Active</span>
            </Show>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setTheme("system")
            }}
            class="flex items-center justify-between"
          >
            <div class="flex items-center gap-2">
              <ThemeIcon theme="system" />
              <span>System</span>
            </div>
            <Show when={theme() === "system"}>
              <span class="text-muted-foreground text-xs">Active</span>
            </Show>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Editor">
          <CommandItem
            onSelect={() => {
              toggleVimMode()
            }}
            class="flex items-center justify-between"
          >
            <div class="flex items-center gap-2">
              <div
                class={`size-4 rounded-sm border ${vimModeEnabled() ? "border-primary bg-primary" : "border-muted-foreground/30 bg-muted"}`}
              />
              <span>Vim Mode</span>
            </div>
            <div class="flex items-center gap-2">
              <Show when={vimModeEnabled()}>
                <span class="text-muted-foreground text-xs">Enabled</span>
              </Show>
            </div>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
