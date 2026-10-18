import { describe, expect, it } from "vitest"
import {
  cleanContinuation,
  deepseekCompletionExtras,
  readCompletionPrefix,
} from "./completion-text"

describe("completion text", () => {
  it("keeps only the new sentences", () => {
    const prefix = "林晚站在塔下，雨已经下了一整夜。"
    const raw = `${prefix}她抬手按住门环，没有立刻推开。`
    expect(cleanContinuation(prefix, raw)).toBe("她抬手按住门环，没有立刻推开。")
  })

  it("drops a fenced repeat of the tail", () => {
    const prefix = `${"甲".repeat(100)}守塔人在江城等雨。`
    const raw = "```text\n守塔人在江城等雨。灯还亮着。\n```"
    expect(cleanContinuation(prefix, raw)).toBe("灯还亮着。")
  })

  it("stops after two paragraphs and 400 characters", () => {
    const long = `${"雨".repeat(300)}\n\n${"风".repeat(200)}\n\n${"雪".repeat(50)}`
    const cleaned = cleanContinuation("开头。", long)
    expect(cleaned).not.toContain("雪")
    expect(cleaned.length).toBeLessThanOrEqual(400)
  })

  it("disables thinking only for DeepSeek completions", () => {
    expect(deepseekCompletionExtras("https://api.deepseek.com/chat/completions")).toEqual({
      thinking: { type: "disabled" },
    })
    expect(deepseekCompletionExtras("https://api.openai.com/v1/chat/completions")).toEqual({})
    expect(deepseekCompletionExtras("not a url")).toEqual({})
  })

  it("uses the tail of a long prefix", () => {
    const prefix = readCompletionPrefix(`甲${"乙".repeat(9000)}`)
    expect(prefix.startsWith("乙")).toBe(true)
    expect(prefix.length).toBe(4000)
  })
})
