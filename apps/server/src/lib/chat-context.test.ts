import { describe, expect, it } from "vitest"
import { assembleChatPrompt, relatedPlotIds } from "./chat-context"
import { htmlToPlainText } from "./html-text"

describe("htmlToPlainText", () => {
  it("keeps paragraph breaks and drops tags", () => {
    expect(htmlToPlainText("<p>你好<br>世界</p><p>下一章</p>")).toBe("你好\n世界\n下一章")
  })
})

describe("relatedPlotIds", () => {
  it("keeps threads linked to the chapter or to a character in that chapter", () => {
    const ids = relatedPlotIds({
      chapterId: "ch-2",
      characterIds: ["hero"],
      chapterLinks: [{ plotPointId: "by-chapter", chapterId: "ch-2" }],
      legacyLinks: [{ plotPointId: "legacy", chapterId: "ch-2" }],
      characterLinks: [
        { plotPointId: "by-hero", characterId: "hero" },
        { plotPointId: "other", characterId: "villain" },
      ],
    })

    expect(ids.sort()).toEqual(["by-chapter", "by-hero", "legacy"])
  })

  it("returns nothing when the chapter has no links", () => {
    expect(
      relatedPlotIds({
        chapterId: "ch-1",
        characterIds: [],
        chapterLinks: [{ plotPointId: "elsewhere", chapterId: "ch-9" }],
        legacyLinks: [],
        characterLinks: [],
      })
    ).toEqual([])
  })
})

describe("assembleChatPrompt", () => {
  it("omits the project blurb and only includes the supplied chapter packet", () => {
    const prompt = assembleChatPrompt({
      title: "长夜",
      type: "novel",
      genre: "奇幻",
      characters: [{ name: "林昭", text: `剑客${"甲".repeat(600)}` }],
      locations: [{ name: "江城", text: "江边的城" }],
      lore: [{ name: "潮汐", text: "每晚涨一次" }],
      plotThreads: [{ name: "寻剑", text: "剑在上一卷丢了" }],
      currentChapter: { title: "第三章", text: "他推开了门。" },
      previousChapters: [{ title: "第二章", text: "雨下了一夜。" }],
      summaries: [{ title: "第一章", text: "林昭离开江城。" }],
    })

    expect(prompt).toContain("- Title: 长夜 (novel)")
    expect(prompt).toContain("- Genre: 奇幻")
    expect(prompt).not.toContain("- Description:")
    expect(prompt).toContain("林昭 — 剑客")
    expect(prompt).toContain("甲".repeat(600))
    expect(prompt).toContain("LOCATIONS:")
    expect(prompt).toContain("江城")
    expect(prompt).toContain("WORLD:")
    expect(prompt).toContain("潮汐")
    expect(prompt).toContain("寻剑")
    expect(prompt).toContain("CURRENT CHAPTER:")
    expect(prompt).toContain("他推开了门。")
    expect(prompt).toContain("PREVIOUS CHAPTERS:")
    expect(prompt).toContain("雨下了一夜。")
    expect(prompt).toContain("CHAPTER SUMMARIES TO INCLUDE:")
    expect(prompt).toContain("林昭离开江城。")
  })

  it("leaves characters and plot threads out when none were bound", () => {
    const prompt = assembleChatPrompt({
      title: "长夜",
      type: "novel",
      genre: null,
      characters: [],
      locations: [],
      lore: [],
      plotThreads: [],
      currentChapter: null,
      previousChapters: [],
      summaries: [],
    })

    expect(prompt).not.toContain("CHARACTERS IN THE CURRENT CHAPTER")
    expect(prompt).not.toContain("PLOT THREADS")
    expect(prompt).not.toContain("LOCATIONS")
  })
})
