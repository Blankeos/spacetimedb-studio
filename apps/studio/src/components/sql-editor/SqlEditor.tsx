import { history, historyKeymap, toggleLineComment } from "@codemirror/commands"
import { StandardSQL, sql } from "@codemirror/lang-sql"
import { EditorState, type Extension, Prec, RangeSet, RangeSetBuilder } from "@codemirror/state"
import { oneDark } from "@codemirror/theme-one-dark"
import {
  Decoration,
  type DecorationSet,
  EditorView,
  keymap,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view"
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
  ".cm-selected-line": {
    backgroundColor: "rgba(134, 239, 172, 0.15) !important",
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
      selectedLinePlugin(),
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
