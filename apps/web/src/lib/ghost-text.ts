import { Extension } from "@tiptap/core"
import type { Transaction } from "@tiptap/pm/state"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import type { Editor } from "@tiptap/react"

interface GhostMeta {
  text: string
}

interface GhostPluginState {
  decorations: DecorationSet
  from: number
  text: string
}

const ghostTextKey = new PluginKey<GhostPluginState>("ghostText")

function ghostWidget(text: string): HTMLElement {
  const span = document.createElement("span")
  span.className = "ghost-text"
  span.setAttribute("aria-hidden", "true")
  span.textContent = text
  return span
}

function cleared(): GhostPluginState {
  return { decorations: DecorationSet.empty, from: 0, text: "" }
}

function readGhostMeta(tr: Transaction): GhostMeta | null {
  const meta: unknown = tr.getMeta(ghostTextKey)
  if (!meta || typeof meta !== "object" || !("text" in meta) || typeof meta.text !== "string") {
    return null
  }
  return { text: meta.text }
}

function keepGhost(tr: Transaction, previous: GhostPluginState): GhostPluginState {
  const from = tr.mapping.map(previous.from)
  if (tr.docChanged || !tr.selection.empty || tr.selection.from !== from) {
    return cleared()
  }
  return {
    decorations: previous.decorations.map(tr.mapping, tr.doc),
    from,
    text: previous.text,
  }
}

export const ghostTextExtension = Extension.create({
  name: "ghostText",
  addProseMirrorPlugins() {
    return [
      new Plugin<GhostPluginState>({
        key: ghostTextKey,
        state: {
          init: () => cleared(),
          apply(tr, previous) {
            const meta = readGhostMeta(tr)
            if (!meta) {
              if (previous.text.length === 0) {
                return cleared()
              }
              return keepGhost(tr, previous)
            }
            if (meta.text.length === 0) {
              return cleared()
            }
            const from = tr.selection.from
            const widget = Decoration.widget(from, () => ghostWidget(meta.text), {
              ignoreSelection: true,
              inline: true,
              side: 1,
            })
            return {
              decorations: DecorationSet.create(tr.doc, [widget]),
              from,
              text: meta.text,
            }
          },
        },
        props: {
          decorations(state) {
            return ghostTextKey.getState(state)?.decorations ?? DecorationSet.empty
          },
          handleKeyDown(view, event) {
            const ghost = ghostTextKey.getState(view.state)
            if (!ghost || ghost.text.length === 0) {
              return false
            }
            if (event.key === "Escape") {
              event.preventDefault()
              view.dispatch(view.state.tr.setMeta(ghostTextKey, { text: "" }))
              return true
            }
            if (event.key !== "Tab" || event.shiftKey) {
              return false
            }
            event.preventDefault()
            const text = ghost.text
            view.dispatch(view.state.tr.insertText(text).setMeta(ghostTextKey, { text: "" }))
            return true
          },
        },
      }),
    ]
  },
})

export function setGhostText(editor: Editor, text: string) {
  if (editor.isDestroyed) {
    return
  }
  editor.view.dispatch(editor.state.tr.setMeta(ghostTextKey, { text }))
}
