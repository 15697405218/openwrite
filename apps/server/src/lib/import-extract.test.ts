import { describe, expect, it } from "vitest"
import { importExtractPrompt, parseImportExtract } from "./import-extract"

describe("parseImportExtract", () => {
  it("reads a fenced json object and ignores prose around it", () => {
    const extract = parseImportExtract(
      '```json\n{"characters":[{"name":"林晚","description":"守塔人"}],"locations":[],"lore":[],"plot":[{"title":"七夜雨","description":""}],"chapterTitles":["第一章"],"mentions":{"characters":["林晚"],"locations":[],"plot":[]}}\n```'
    )
    expect(extract?.characters[0]?.name).toBe("林晚")
    expect(extract?.plot[0]?.title).toBe("七夜雨")
    expect(extract?.chapterTitles).toEqual(["第一章"])
    expect(extract?.mentions.characters).toEqual(["林晚"])
  })

  it("returns null when the model does not return json", () => {
    expect(parseImportExtract("我来帮你改写这一章。")).toBeNull()
  })

  it("tells the model which names are already saved", () => {
    const prompt = importExtractPrompt({
      knownNames: ["林晚"],
      mode: "settings",
      section: "人物",
      text: "沈照在码头等船。",
    })
    expect(prompt).toContain("Mode: settings")
    expect(prompt).toContain("Section: 人物")
    expect(prompt).toContain("林晚")
    expect(prompt).toContain("沈照在码头等船。")
  })
})
