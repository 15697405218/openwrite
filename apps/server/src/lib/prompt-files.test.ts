import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { readPrompt } from "./prompt-files"

describe("readPrompt", () => {
  it("uses the markdown file and keeps it in memory", () => {
    const file = join(process.cwd(), "src", "prompts", "chat-system.md")
    const disk = readFileSync(file, "utf8").replaceAll("\r\n", "\n").trim()

    expect(readPrompt("chat-system")).toBe(disk)
    expect(readPrompt("chat-system")).toBe(disk)
  })
})
