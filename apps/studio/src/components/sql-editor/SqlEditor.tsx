import { history, historyKeymap, toggleLineComment } from "@codemirror/commands"
import { StandardSQL, sql } from "@codemirror/lang-sql"
import { EditorState, type Extension, Prec } from "@codemirror/state"
import { oneDark } from "@codemirror/theme-one-dark"
import { EditorView, keymap } from "@codemirror/view"
import { vim } from "@replit/codemirror-vim"
import { createEffect, on, onMount } from "solid-js"

type SqlEditorProps = {
  value: string
  onChange: (value: string) => void
  onExecute: () => void
  vimMode?: boolean
  readOnly?: boolean
  class?: string
}

const editorTheme = EditorView.theme({
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
})

const vimStyles = Prec.highest(
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

export function SqlEditor(props: SqlEditorProps) {
  let editorRef: HTMLDivElement | undefined
  let view: EditorView | undefined

  const createExtensions = (vimMode: boolean): Extension[] => {
    const ext: Extension[] = [
      sql({ dialect: StandardSQL }),
      oneDark,
      editorTheme,
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
    ]

    if (vimMode) {
      ext.push(vim({ status: true }))
      ext.push(vimStyles)
    }

    return ext
  }

  onMount(() => {
    if (!editorRef) return

    const state = EditorState.create({
      doc: props.value,
      extensions: createExtensions(props.vimMode ?? false),
    })

    view = new EditorView({
      state,
      parent: editorRef,
    })
  })

  createEffect(
    on(
      () => props.vimMode,
      (vimMode) => {
        if (!view) return

        const newState = EditorState.create({
          doc: view.state.doc.toString(),
          extensions: createExtensions(vimMode ?? false),
        })
        view.setState(newState)
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
