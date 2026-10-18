import { describe, expect, it } from "vitest"
import { countWordsInHtml } from "../word-count"

describe("countWordsInHtml", () => {
  it("counts words in editor HTML", () => {
    expect(countWordsInHtml("<h1>Chapter One</h1><p>The dragons were restless.</p>")).toBe(6)
  })

  it("matches the server count for empty and markup-only content", () => {
    expect(countWordsInHtml("")).toBe(0)
    expect(countWordsInHtml("<p></p>")).toBe(0)
  })

  it("handles entities and repeated whitespace", () => {
    expect(countWordsInHtml("<p>one&nbsp;two   three</p>")).toBe(3)
  })

  it("counts each Chinese character and ignores punctuation", () => {
    expect(countWordsInHtml("<p>清河镇的雨落了七天。</p>")).toBe(9)
  })

  it("counts a Latin run inside Chinese as one word", () => {
    expect(countWordsInHtml("<p>你说ddd</p>")).toBe(3)
  })
})
