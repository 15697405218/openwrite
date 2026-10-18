import { describe, expect, it } from "vitest"
import {
  boundedOutputTokens,
  CHAT_MAX_TOKENS,
  CODEX_SUMMARY_MAX_TOKENS,
  CONVERSATION_SUMMARY_MAX_TOKENS,
} from "./output-budget"

describe("output budgets", () => {
  it("leaves a full write inside the chat ceiling", () => {
    expect(CHAT_MAX_TOKENS).toBeGreaterThanOrEqual(20_000)
  })

  it("leaves thinking room on the summary calls", () => {
    expect(CONVERSATION_SUMMARY_MAX_TOKENS).toBeGreaterThan(8192)
    expect(CODEX_SUMMARY_MAX_TOKENS).toBeGreaterThan(32_768)
  })

  it("sends the full budget only to DeepSeek", () => {
    expect(boundedOutputTokens("https://api.deepseek.com/chat/completions", CHAT_MAX_TOKENS)).toBe(
      CHAT_MAX_TOKENS
    )
    expect(boundedOutputTokens("https://api.openai.com/v1/chat/completions", CHAT_MAX_TOKENS)).toBe(
      8192
    )
    expect(boundedOutputTokens("not a url", CHAT_MAX_TOKENS)).toBe(8192)
  })
})
