import { describe, expect, it } from "vitest"
import {
  absorbExtract,
  chunkText,
  emptyCatalog,
  fileTitle,
  isChapterTitle,
  parseImportFiles,
  textToHtml,
} from "../import-book"

describe("parseImportFiles", () => {
  it("keeps chapter text and separates a settings heading", () => {
    const parsed = parseImportFiles([
      {
        name: "灯下雨.md",
        text: [
          "# 人物",
          "林晚，守塔人。",
          "",
          "# 第一章 塔下",
          "雨下了七夜。",
          "",
          "# 第二章 码头",
          "船没有来。",
        ].join("\n"),
      },
    ])

    expect(parsed.settings.map((section) => section.heading)).toEqual(["人物"])
    expect(parsed.settings[0]?.text).toContain("林晚")
    expect(parsed.chapters.map((chapter) => chapter.title)).toEqual(["第一章 塔下", "第二章 码头"])
    expect(parsed.chapters[0]?.text).toBe("雨下了七夜。")
    expect(parsed.chapters[1]?.text).toBe("船没有来。")
  })

  it("groups chapters under a volume heading", () => {
    const parsed = parseImportFiles([
      {
        name: "book.txt",
        text: ["第一卷 星海", "Chapter 1 Dock", "The bell rang."].join("\n"),
      },
    ])

    expect(parsed.chapters[0]?.volumeTitle).toBe("第一卷 星海")
    expect(parsed.chapters[0]?.title).toBe("Chapter 1 Dock")
    expect(parsed.chapters[0]?.text).toBe("The bell rang.")
  })

  it("treats unlabeled notes as notes", () => {
    const parsed = parseImportFiles([
      { name: "ideas.md", text: "一个会下雨的城。\n守塔人还没有名字。" },
    ])
    expect(parsed.chapters).toEqual([])
    expect(parsed.settings).toEqual([])
    expect(parsed.notes[0]?.title).toBe("ideas")
    expect(parsed.notes[0]?.text).toContain("守塔人")
    expect(parsed.outlines).toEqual([])
  })

  it("stores an outline section as book, volume, and detail nodes", () => {
    const parsed = parseImportFiles([
      {
        name: "大纲.md",
        text: [
          "# 大纲",
          "全书讲守塔。",
          "## 第一卷 星海",
          "这一卷出海。",
          "## 第一章 塔下",
          "林晚决定留下。",
          "# 第一章 塔下",
          "雨下了七夜。",
        ].join("\n"),
      },
    ])

    expect(parsed.chapters.map((chapter) => chapter.title)).toEqual(["第一章 塔下"])
    expect(parsed.chapters[0]?.text).toBe("雨下了七夜。")
    expect(parsed.settings).toEqual([])
    expect(parsed.outlines).toHaveLength(1)
    expect(parsed.outlines[0]).toContain("守塔")
    expect(parsed.outlines[0]).toContain("第一卷 星海")
    expect(parsed.outlines[0]).toContain("出海")
    expect(parsed.outlines[0]).toContain("第一章 塔下")
    expect(parsed.outlines[0]).toContain("留下")
  })

  it("keeps a plain outline file out of the manuscript", () => {
    const parsed = parseImportFiles([
      {
        name: "outline.txt",
        text: ["大纲", "全书讲守塔。", "第一卷 星海", "第一章 塔下", "林晚决定留下。"].join("\n"),
      },
    ])

    expect(parsed.chapters).toEqual([])
    expect(parsed.outlines).toHaveLength(1)
    expect(parsed.outlines[0]).toContain("守塔")
    expect(parsed.outlines[0]).toContain("第一卷 星海")
    expect(parsed.outlines[0]).toContain("留下")
  })
})

describe("import helpers", () => {
  it("splits a long passage on a line break", () => {
    const text = `${"甲".repeat(7000)}\n${"乙".repeat(2000)}`
    const chunks = chunkText(text)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.join("")).toContain("乙")
  })

  it("keeps a settings description when the manuscript mentions the same name", () => {
    const catalog = emptyCatalog()
    absorbExtract(
      catalog,
      {
        chapterTitles: [],
        characters: [{ description: "守塔人。", name: "林晚" }],
        locations: [],
        lore: [],
        mentions: { characters: [], locations: [], plot: [] },
        plot: [],
      },
      { chapterKey: null, locked: true }
    )
    absorbExtract(
      catalog,
      {
        chapterTitles: [],
        characters: [{ description: "改写后的说明", name: "林晚" }],
        locations: [],
        lore: [],
        mentions: { characters: ["林晚"], locations: [], plot: [] },
        plot: [],
      },
      { chapterKey: "c1", locked: false }
    )
    expect(catalog.characters[0]?.description).toBe("守塔人。")
    expect(catalog.characters[0]?.chapterKeys).toEqual(["c1"])
  })

  it("turns paragraphs into html without keeping raw brackets", () => {
    expect(textToHtml("甲<乙>\n\n丙")).toBe("<p>甲&lt;乙&gt;</p><p>丙</p>")
    expect(fileTitle("灯下雨.md")).toBe("灯下雨")
    expect(isChapterTitle("第一章 塔下")).toBe(true)
    expect(isChapterTitle("守塔人")).toBe(false)
  })
})
