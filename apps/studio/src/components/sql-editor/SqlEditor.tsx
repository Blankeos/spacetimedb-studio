import { StandardSQL, sql } from "@codemirror/lang-sql"
import { EditorState } from "@codemirror/state"
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

export function SqlEditor(props: SqlEditorProps) {
  let editorRef: HTMLDivElement | undefined
  let view: EditorView | undefined

  onMount(() => {
    if (!editorRef) return

    const extensions = [
      sql({ dialect: StandardSQL }),
      oneDark,
      keymap.of([
        {
          key: "Mod-Enter",
          run: () => {
            props.onExecute()
            return true
          },
        },
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

    if (props.vimMode) {
      extensions.push(vim())
    }

    const state = EditorState.create({
      doc: props.value,
      extensions,
    })

    view = new EditorView({
      state,
      parent: editorRef,
    })

    EditorView.theme({
      "&": { height: "100%" },
      ".cm-scroller": { overflow: "auto" },
      ".cm-content": { padding: "12px" },
    })
  })

  createEffect(
    on(
      () => props.vimMode,
      (vimMode) => {
        if (!view) return

        const newState = EditorState.create({
          doc: view.state.doc.toString(),
          extensions: [
            sql({ dialect: StandardSQL }),
            oneDark,
            vimMode ? vim() : [],
            keymap.of([
              {
                key: "Mod-Enter",
                run: () => {
                  props.onExecute()
                  return true
                },
              },
            ]),
            EditorView.updateListener.of(
              (update: { docChanged: boolean; state: { doc: { toString: () => string } } }) => {
                if (update.docChanged) {
                  props.onChange(update.state.doc.toString())
                }
              }
            ),
            EditorView.lineWrapping,
          ],
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
