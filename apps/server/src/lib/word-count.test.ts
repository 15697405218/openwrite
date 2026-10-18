import { describe, expect, it } from "vitest"
import { countWordsInHtml } from "./word-count"

describe("countWordsInHtml", () => {
  it("counts words in plain text", () => {
    expect(countWordsInHtml("It was a dark and stormy night")).toBe(7)
  })

  it("strips HTML tags", () => {
    expect(countWordsInHtml("<h1>Chapter One</h1><p>The dragons were restless.</p>")).toBe(6)
  })

  it("treats entities as separators, not words", () => {
    expect(countWordsInHtml("<p>one&nbsp;two</p>")).toBe(2)
  })

  it("returns 0 for empty content", () => {
    expect(countWordsInHtml("")).toBe(0)
  })

  it("returns 0 for markup-only content", () => {
    expect(countWordsInHtml("<p></p><br><div></div>")).toBe(0)
  })

  it("collapses repeated whitespace", () => {
    expect(countWordsInHtml("<p>one   two\n\nthree</p>")).toBe(3)
  })

  it("counts each Chinese character and ignores punctuation", () => {
    expect(countWordsInHtml("<p>清河镇的雨落了七天。</p>")).toBe(9)
  })

  it("counts a Latin run inside Chinese as one word", () => {
    expect(countWordsInHtml("<p>你说ddd</p>")).toBe(3)
  })
})
