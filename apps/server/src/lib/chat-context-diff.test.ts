import { describe, expect, it } from "vitest"
import type { ChatPacket } from "./chat-context"
import { contextUpdate } from "./chat-context-diff"

function packet(chapterText: string): ChatPacket {
  return {
    title: "绑定测试",
    type: "novel",
    genre: "奇幻",
    currentChapter: { id: "ch-1", title: "第一章", text: chapterText },
    previousChapters: [],
    characters: [{ id: "char-1", name: "林晚", text: "CHARACTER_BODY_UNIQUE" }],
    locations: [{ id: "loc-1", name: "江城", text: "江边的城" }],
    lore: [],
    plotThreads: [],
    summaries: [],
  }
}

describe("contextUpdate", () => {
  it("sends the full packet once, then only the changed chapter", () => {
    const first = contextUpdate(null, packet("CHAPTER_ONE"))
    expect(first.text).toContain("CHAPTER_ONE")
    expect(first.text).toContain("CHARACTER_BODY_UNIQUE")

    const same = contextUpdate(first.fingerprint, packet("CHAPTER_ONE"))
    expect(same.text).toBeNull()

    const changed = contextUpdate(first.fingerprint, packet("CHAPTER_TWO"))
    expect(changed.text).toContain("CHAPTER_TWO")
    expect(changed.text).not.toContain("CHARACTER_BODY_UNIQUE")
    expect(changed.text).toContain("UNCHANGED")
    expect(changed.text).toContain("林晚")
  })

  it("names a location that is no longer attached", () => {
    const first = contextUpdate(null, packet("CHAPTER_ONE"))
    const next = packet("CHAPTER_ONE")
    next.locations = []
    const changed = contextUpdate(first.fingerprint, next)
    expect(changed.text).toContain("江城")
    expect(changed.text).toContain("removed")
  })
})
