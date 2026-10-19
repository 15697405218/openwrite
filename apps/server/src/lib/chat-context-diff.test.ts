import { describe, expect, it } from "vitest"
import type { ChatPacket } from "./chat-context"
import { contextUpdate, readFingerprint } from "./chat-context-diff"

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
    outline: { id: "outline-1", name: "Outline", text: "OUTLINE_BODY_UNIQUE" },
    focus: null,
  }
}

describe("contextUpdate", () => {
  it("sends the full packet once, then only the changed chapter", () => {
    const first = contextUpdate(null, packet("CHAPTER_ONE"))
    expect(first.text).toContain("CHAPTER_ONE")
    expect(first.text).toContain("CHARACTER_BODY_UNIQUE")
    expect(first.text).toContain("OUTLINE_BODY_UNIQUE")

    const same = contextUpdate(first.fingerprint, packet("CHAPTER_ONE"))
    expect(same.text).toBeNull()

    const changed = contextUpdate(first.fingerprint, packet("CHAPTER_TWO"))
    expect(changed.text).toContain("CHAPTER_TWO")
    expect(changed.text).not.toContain("CHARACTER_BODY_UNIQUE")
    expect(changed.text).not.toContain("OUTLINE_BODY_UNIQUE")
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

  it("adds the outline when an older fingerprint had none", () => {
    const first = contextUpdate(null, packet("CHAPTER_ONE"))
    const previous = readFingerprint(
      JSON.stringify({
        characters: first.fingerprint.characters,
        current: first.fingerprint.current,
        locations: first.fingerprint.locations,
        lore: first.fingerprint.lore,
        plots: first.fingerprint.plots,
        previous: first.fingerprint.previous,
        summaries: first.fingerprint.summaries,
      })
    )
    const changed = contextUpdate(previous, packet("CHAPTER_ONE"))
    expect(changed.text).toContain("OUTLINE_BODY_UNIQUE")
    expect(changed.text).not.toContain("CHAPTER_ONE")
  })

  it("drops a fingerprint that still lists volume outlines", () => {
    const first = contextUpdate(null, packet("CHAPTER_ONE"))
    const previous = readFingerprint(
      JSON.stringify({ ...first.fingerprint, volumeOutlines: [], detailOutlines: [] })
    )
    expect(previous).toBeNull()
  })
})
