import { Editor } from "@tiptap/core"
import { TextSelection } from "@tiptap/pm/state"
import StarterKit from "@tiptap/starter-kit"
import { afterEach, describe, expect, it } from "vitest"
import { ghostTextExtension, setGhostText } from "./ghost-text"

const PASSAGE = "林晚站在雨里等她回来。"

function mountEditor(): Editor {
  const element = document.createElement("div")
  document.body.append(element)
  return new Editor({
    content: `<p>${PASSAGE}</p>`,
    element,
    extensions: [StarterKit, ghostTextExtension],
  })
}

describe("ghost text", () => {
  const editors: Editor[] = []

  afterEach(() => {
    for (const editor of editors) {
      editor.destroy()
    }
    editors.length = 0
    document.body.replaceChildren()
  })

  it("draws the continuation after the cursor", () => {
    const editor = mountEditor()
    editors.push(editor)
    editor.commands.focus("end")
    setGhostText(editor, "她没有回头。")
    expect(editor.view.dom.querySelector(".ghost-text")?.textContent).toBe("她没有回头。")
  })

  it("keeps the continuation when the selection is set again at the cursor", () => {
    const editor = mountEditor()
    editors.push(editor)
    editor.commands.focus("end")
    setGhostText(editor, "她没有回头。")
    const from = editor.state.selection.from
    const selection = TextSelection.create(editor.state.doc, from)
    editor.view.dispatch(editor.state.tr.setSelection(selection))
    expect(editor.view.dom.querySelector(".ghost-text")?.textContent).toBe("她没有回头。")
  })

  it("clears the continuation when the cursor moves or the text changes", () => {
    const editor = mountEditor()
    editors.push(editor)
    editor.commands.focus("end")
    setGhostText(editor, "她没有回头。")
    editor.commands.setTextSelection(1)
    expect(editor.view.dom.querySelector(".ghost-text")).toBeNull()

    editor.commands.focus("end")
    setGhostText(editor, "她没有回头。")
    editor.commands.insertContent("啊")
    expect(editor.view.dom.querySelector(".ghost-text")).toBeNull()
  })

  it("accepts with Tab only while a suggestion is showing", () => {
    const editor = mountEditor()
    editors.push(editor)
    editor.commands.focus("end")
    const before = editor.getText()
    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Tab" })
    )
    expect(editor.getText()).toBe(before)

    setGhostText(editor, "她没有回头。")
    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Tab" })
    )
    expect(editor.getText()).toContain("她没有回头。")
    expect(editor.view.dom.querySelector(".ghost-text")).toBeNull()
  })

  it("dismisses with Escape", () => {
    const editor = mountEditor()
    editors.push(editor)
    editor.commands.focus("end")
    setGhostText(editor, "她没有回头。")
    const before = editor.getText()
    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Escape" })
    )
    expect(editor.getText()).toBe(before)
    expect(editor.view.dom.querySelector(".ghost-text")).toBeNull()
  })
})
