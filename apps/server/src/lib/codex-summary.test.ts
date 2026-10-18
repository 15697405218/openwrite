import { describe, expect, it } from "vitest"
import { codexPromptText } from "./chat-context"

const FULL_ENTRY_CHARS = 5_000

describe("codexPromptText", () => {
  it("uses the stored summary when one exists", () => {
    expect(codexPromptText("压缩后的全文事实", "很长的原文")).toBe("压缩后的全文事实")
  })

  it("uses the full source when there is no summary", () => {
    const source = "甲".repeat(FULL_ENTRY_CHARS)
    expect(codexPromptText(null, source)).toBe(source)
    expect(codexPromptText("  ", source)).toBe(source)
  })
})
