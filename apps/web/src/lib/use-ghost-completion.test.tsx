import { act, cleanup, render } from "@testing-library/react"
import { Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { afterEach, describe, expect, it, vi } from "vitest"
import { aiApi } from "@/lib/api"
import { setAutocompleteEnabled, setAutocompleteModel } from "@/lib/autocomplete"
import { ghostTextExtension } from "@/lib/ghost-text"
import { useGhostCompletion } from "@/lib/use-ghost-completion"

vi.mock("@/lib/api", () => ({
  aiApi: {
    complete: vi.fn(),
  },
}))

const PASSAGE = "林晚站在雨里等她回来。"

function mountEditor(): Editor {
  const element = document.createElement("div")
  document.body.append(element)
  const editor = new Editor({
    content: `<p>${PASSAGE}</p>`,
    element,
    extensions: [StarterKit, ghostTextExtension],
  })
  editor.commands.focus("end")
  return editor
}

function press(target: HTMLElement, init: KeyboardEventInit) {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

function Host({ editor, projectId }: { editor: Editor | null; projectId?: string }) {
  useGhostCompletion(editor, projectId)
  return null
}

describe("ghost completion shortcut", () => {
  const editors: Editor[] = []

  afterEach(() => {
    cleanup()
    setAutocompleteEnabled(false)
    for (const editor of editors) {
      editor.destroy()
    }
    editors.length = 0
    document.body.replaceChildren()
    vi.clearAllMocks()
  })

  it("does not call the API when typing pauses", () => {
    setAutocompleteEnabled(true)
    const editor = mountEditor()
    editors.push(editor)
    render(<Host editor={editor} projectId="project-1" />)
    act(() => {
      editor.commands.insertContent("雨还在下。")
    })
    expect(aiApi.complete).not.toHaveBeenCalled()
  })

  it("does nothing on Alt+/ while autocomplete is off", () => {
    const editor = mountEditor()
    editors.push(editor)
    render(<Host editor={editor} projectId="project-1" />)
    const event = press(editor.view.dom, { altKey: true, code: "Slash", key: "/" })
    expect(event.defaultPrevented).toBe(false)
    expect(aiApi.complete).not.toHaveBeenCalled()
  })

  it("requests one continuation on Alt+/ and shows it", async () => {
    vi.mocked(aiApi.complete).mockResolvedValue({ text: "她没有回头。" })
    setAutocompleteModel("deepseek-flash")
    setAutocompleteEnabled(true)
    const editor = mountEditor()
    editors.push(editor)
    render(<Host editor={editor} projectId="project-1" />)
    await act(async () => {
      press(editor.view.dom, { altKey: true, code: "Slash", key: "/" })
      await Promise.resolve()
    })
    expect(aiApi.complete).toHaveBeenCalledTimes(1)
    expect(aiApi.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "deepseek-flash",
        prefix: PASSAGE,
        projectId: "project-1",
      })
    )
    expect(editor.view.dom.querySelector(".ghost-text")?.textContent).toBe("她没有回头。")
  })

  it("ignores Ctrl+Space and Ctrl+J", () => {
    vi.mocked(aiApi.complete).mockResolvedValue({ text: "不会出现。" })
    setAutocompleteEnabled(true)
    const editor = mountEditor()
    editors.push(editor)
    render(<Host editor={editor} projectId="project-1" />)
    act(() => {
      press(editor.view.dom, { code: "Space", ctrlKey: true, key: " " })
      press(editor.view.dom, { code: "KeyJ", ctrlKey: true, key: "j" })
      press(editor.view.dom, { code: "KeyJ", key: "j", metaKey: true })
    })
    expect(aiApi.complete).not.toHaveBeenCalled()
  })
})
