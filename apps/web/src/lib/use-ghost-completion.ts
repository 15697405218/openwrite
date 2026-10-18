import type { Editor } from "@tiptap/react"
import { useEffect, useSyncExternalStore } from "react"
import { aiApi } from "@/lib/api"
import { getAutocompleteSnapshot, subscribeAutocomplete } from "@/lib/autocomplete"
import { setGhostText } from "@/lib/ghost-text"

const MIN_PREFIX = 8
const PREFIX_CHARS = 4000

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}

export function isAutocompleteShortcut(event: KeyboardEvent): boolean {
  if (event.repeat || event.ctrlKey || event.metaKey || event.shiftKey || !event.altKey) {
    return false
  }
  return event.key === "/" || event.code === "Slash"
}

function prefixBeforeCursor(editor: Editor): { from: number; text: string } | null {
  const { selection, doc } = editor.state
  if (!selection.empty || editor.isActive("codeBlock")) {
    return null
  }
  const from = selection.from
  const text = doc.textBetween(Math.max(0, from - PREFIX_CHARS), from, "\n")
  if (text.trim().length < MIN_PREFIX) {
    return null
  }
  return { from, text }
}

export function useGhostCompletion(editor: Editor | null, projectId?: string) {
  const autocomplete = useSyncExternalStore(
    subscribeAutocomplete,
    getAutocompleteSnapshot,
    getAutocompleteSnapshot
  )

  useEffect(() => {
    if (!(editor && autocomplete.enabled && projectId)) {
      return
    }
    let generation = 0
    let abort: AbortController | null = null

    const requestSuggestion = async (ticket: number, from: number, text: string) => {
      abort = new AbortController()
      try {
        const result = await aiApi.complete({
          model: autocomplete.modelId,
          prefix: text,
          projectId,
          signal: abort.signal,
        })
        if (ticket !== generation || editor.isDestroyed) {
          return
        }
        if (editor.state.selection.from !== from || !editor.state.selection.empty) {
          return
        }
        if (result.text.length === 0) {
          return
        }
        setGhostText(editor, result.text)
      } catch (error) {
        if (isAbort(error)) {
          return
        }
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (
        !(
          isAutocompleteShortcut(event) &&
          target instanceof Node &&
          editor.view.dom.contains(target)
        )
      ) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      const prefix = prefixBeforeCursor(editor)
      if (!prefix) {
        return
      }
      abort?.abort()
      generation += 1
      const ticket = generation
      requestSuggestion(ticket, prefix.from, prefix.text).catch((error: unknown) => {
        if (isAbort(error)) {
          return
        }
      })
    }

    const onUpdate = () => {
      abort?.abort()
      generation += 1
    }

    editor.view.dom.addEventListener("keydown", onKeyDown, true)
    editor.on("update", onUpdate)
    return () => {
      generation += 1
      abort?.abort()
      if (editor.isDestroyed) {
        return
      }
      editor.view.dom.removeEventListener("keydown", onKeyDown, true)
      editor.off("update", onUpdate)
      setGhostText(editor, "")
    }
  }, [autocomplete.enabled, autocomplete.modelId, editor, projectId])
}
