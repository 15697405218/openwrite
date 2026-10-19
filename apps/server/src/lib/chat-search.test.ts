import { describe, expect, it } from "vitest"
import { searchSnippets } from "./chat-search"
import { manuscriptTools } from "./chat-tool-schema"

describe("manuscript tools", () => {
  it("publishes the manuscript tool schema", () => {
    const names = manuscriptTools.map((tool) => tool.function.name)
    expect(names).toEqual([
      "list_chapters",
      "read_chapter",
      "list_characters",
      "read_character",
      "list_locations",
      "read_location",
      "list_plots",
      "read_plot",
      "list_lore",
      "read_lore",
      "read_outline",
      "list_notes",
      "read_note",
      "search_text",
      "append_to_chapter",
      "append_to_outline",
      "replace_in_outline",
      "append_to_entry",
      "replace_in_entry",
      "create_entry",
      "delete_entry",
      "replace_in_chapter",
    ])
    const search = manuscriptTools.find((tool) => tool.function.name === "search_text")
    expect(search?.function.parameters.required).toEqual(["query"])
    const append = manuscriptTools.find((tool) => tool.function.name === "append_to_chapter")
    expect(append?.function.parameters.required).toEqual(["text"])
    const replace = manuscriptTools.find((tool) => tool.function.name === "replace_in_chapter")
    expect(replace?.function.parameters.required).toEqual(["find", "replace"])
  })

  it("returns an excerpt around a chapter phrase", () => {
    const hits = searchSnippets(
      [
        { id: "a", title: "第一章", text: "序幕。守塔人在江城等雨。" },
        { id: "b", title: "第二章", text: "没有这场雨。" },
      ],
      "守塔人"
    )
    expect(hits).toHaveLength(1)
    expect(hits[0]?.chapterId).toBe("a")
    expect(hits[0]?.excerpt).toContain("守塔人")
  })
})
