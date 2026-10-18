import { describe, expect, it, vi } from "vitest"

vi.mock("../db", async () => {
  const mod = await import("../test/test-db")
  return { db: mod.testDb }
})

import { appendParagraphs, replaceOnce } from "./chat-write"

describe("chapter write helpers", () => {
  it("appends plain prose as paragraphs", () => {
    const html = appendParagraphs("<p>序幕。</p>", "她推开门。\n灯还亮着。\n\n雨停了。")
    expect(html).toBe("<p>序幕。</p><p>她推开门。<br>灯还亮着。</p><p>雨停了。</p>")
  })

  it("escapes markup in appended prose", () => {
    const html = appendParagraphs("<p></p>", "a < b & c")
    expect(html).toContain("a &lt; b &amp; c")
  })

  it("replaces one exact phrase", () => {
    const result = replaceOnce("<p>守塔人在江城等雨。</p>", "江城", "旧港")
    expect(result).toEqual({ html: "<p>守塔人在旧港等雨。</p>" })
  })

  it("refuses a phrase that appears twice or crosses formatting", () => {
    expect(replaceOnce("<p>江城。江城。</p>", "江城", "旧港")).toEqual({
      error: "phrase matches more than once",
    })
    expect(replaceOnce("<p>守<b>塔</b>人</p>", "守塔人", "看门人")).toEqual({
      error: "phrase crosses formatting; choose a shorter exact phrase",
    })
    expect(replaceOnce("<p>序幕。</p>", "不存在", "x")).toEqual({ error: "phrase not found" })
  })
})
