import { history, historyKeymap, toggleLineComment } from "@codemirror/commands"
import { StandardSQL, sql } from "@codemirror/lang-sql"
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { EditorState, type Extension, Prec, RangeSetBuilder } from "@codemirror/state"
import { oneDark } from "@codemirror/theme-one-dark"
import {
  Decoration,
  type DecorationSet,
  EditorView,
  keymap,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view"
import { tags } from "@lezer/highlight"
import { vim } from "@replit/codemirror-vim"
import { createEffect, on, onMount } from "solid-js"
import { useThemeContext } from "@/contexts/theme"
import { useVimModeContext } from "@/contexts/vim-mode"

type SqlEditorProps = {
  value: string
  onChange: (value: string) => void
  onExecute: () => void
  readOnly?: boolean
  class?: string
}

const selectedLineHighlight = Decoration.line({
  attributes: { class: "cm-selected-line" },
})

function selectedLinePlugin() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = this.computeDecorations(view)
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.decorations = this.computeDecorations(update.view)
        }
      }

      computeDecorations(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>()
        const selection = view.state.selection.main

        if (!selection.empty) {
          const fromLine = view.state.doc.lineAt(selection.from).number
          const toLine = view.state.doc.lineAt(selection.to).number
          for (let i = fromLine; i <= toLine; i++) {
            const lineStart = view.state.doc.line(i).from
            builder.add(lineStart, lineStart, selectedLineHighlight)
          }
        }
        return builder.finish()
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  )
}

const darkEditorTheme = EditorView.theme({
  "&": { height: "100%" },
  ".cm-scroller": { overflow: "auto" },
  ".cm-content": { padding: "12px" },
  "&.cm-focused .cm-cursor": { borderLeftColor: "#fff" },
  "&.cm-focused .cm-selectionBackground": {
    background: "rgba(134, 239, 172, 0.25) !important",
  },
  ".cm-selectionBackground": {
    background: "rgba(134, 239, 172, 0.2) !important",
  },
  ".cm-selected-line": {
    backgroundColor: "rgba(134, 239, 172, 0.15) !important",
  },
})

const lightEditorTheme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "#fafafa" },
  ".cm-scroller": { overflow: "auto" },
  ".cm-content": { padding: "12px", color: "#1a1a1a" },
  ".cm-gutters": { backgroundColor: "#fafafa", color: "#737373", border: "none" },
  ".cm-activeLineGutter": { backgroundColor: "#f5f5f5" },
  "&.cm-focused .cm-cursor": { borderLeftColor: "#1a1a1a" },
  "&.cm-focused .cm-selectionBackground": {
    background: "rgba(34, 197, 94, 0.25) !important",
  },
  ".cm-selectionBackground": {
    background: "rgba(34, 197, 94, 0.2) !important",
  },
  ".cm-selected-line": {
    backgroundColor: "rgba(34, 197, 94, 0.15) !important",
  },
})

const lightHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#7c3aed" },
  { tag: tags.string, color: "#059669" },
  { tag: tags.number, color: "#0284c7" },
  { tag: tags.comment, color: "#737373", fontStyle: "italic" },
  { tag: tags.variableName, color: "#1a1a1a" },
  { tag: tags.propertyName, color: "#171717" },
  { tag: tags.typeName, color: "#0369a1" },
  { tag: tags.definition(tags.variableName), color: "#171717" },
  { tag: tags.punctuation, color: "#525252" },
  { tag: tags.bracket, color: "#525252" },
])

const darkVimStyles = Prec.highest(
  EditorView.theme({
    ".cm-vimMode .cm-line::selection": {
      background: "rgba(134, 239, 172, 0.3) !important",
    },
    ".cm-vimMode .cm-line ::selection": {
      background: "rgba(134, 239, 172, 0.3) !important",
    },
    ".cm-vimMode .cm-selectionLayer .cm-selectionBackground": {
      background: "rgba(134, 239, 172, 0.3) !important",
    },
  })
)

const lightVimStyles = Prec.highest(
  EditorView.theme({
    ".cm-vimMode .cm-line::selection": {
      background: "rgba(34, 197, 94, 0.3) !important",
    },
    ".cm-vimMode .cm-line ::selection": {
      background: "rgba(34, 197, 94, 0.3) !important",
    },
    ".cm-vimMode .cm-selectionLayer .cm-selectionBackground": {
      background: "rgba(34, 197, 94, 0.3) !important",
    },
  })
)

export function SqlEditor(props: SqlEditorProps) {
  const { vimModeEnabled } = useVimModeContext()
  const { inferredTheme } = useThemeContext()
  let editorRef: HTMLDivElement | undefined
  let view: EditorView | undefined

  const createExtensions = (vimMode: boolean, isDark: boolean): Extension[] => {
    const ext: Extension[] = [
      sql({ dialect: StandardSQL }),
      ...(isDark
        ? [oneDark, darkEditorTheme]
        : [lightEditorTheme, syntaxHighlighting(lightHighlightStyle)]),
      history(),
      keymap.of([
        {
          key: "Mod-Enter",
          run: () => {
            props.onExecute()
            return true
          },
        },
        {
          key: "Mod-/",
          run: toggleLineComment,
        },
        ...historyKeymap,
      ]),
      EditorView.updateListener.of(
        (update: { docChanged: boolean; state: { doc: { toString: () => string } } }) => {
          if (update.docChanged) {
            props.onChange(update.state.doc.toString())
          }
        }
      ),
      EditorView.lineWrapping,
      EditorState.readOnly.of(props.readOnly ?? false),
      selectedLinePlugin(),
    ]

    if (vimMode) {
      ext.push(vim())
      ext.push(isDark ? darkVimStyles : lightVimStyles)
    }

    return ext
  }

  onMount(() => {
    if (!editorRef) return

    const state = EditorState.create({
      doc: props.value,
      extensions: createExtensions(vimModeEnabled(), inferredTheme() === "dark"),
    })

    view = new EditorView({
      state,
      parent: editorRef,
    })
  })

  createEffect(
    on([vimModeEnabled, inferredTheme], ([vimMode, theme]) => {
      if (!view) return

      const newState = EditorState.create({
        doc: view.state.doc.toString(),
        extensions: createExtensions(vimMode, theme === "dark"),
      })
      view.setState(newState)
    })
  )

  createEffect(
    on(
      () => props.value,
      (value) => {
        if (!view) return
        const currentValue = view.state.doc.toString()
        if (value !== currentValue) {
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: value },
          })
        }
      }
    )
  )

  return (
    <div
      ref={editorRef}
      class={`h-full w-full overflow-hidden border border-border ${props.class || ""}`}
    />
  )
}
