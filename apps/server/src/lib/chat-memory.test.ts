import { describe, expect, it } from "vitest"
import {
  foldMessage,
  KEEP_RECENT_MESSAGES,
  messagesAfter,
  overflowSplit,
  type StoredChatMessage,
} from "./chat-memory"

function message(id: string, role: StoredChatMessage["role"], content: string): StoredChatMessage {
  return { id, role, content }
}

describe("chat memory window", () => {
  it("keeps the newest messages and folds context without the chapter body", () => {
    const messages = Array.from({ length: KEEP_RECENT_MESSAGES + 1 }, (_, index) =>
      message(String(index), "user", `问 ${index}`)
    )
    const split = overflowSplit(messages)
    expect(split?.overflow).toHaveLength(1)
    expect(split?.keep).toHaveLength(KEEP_RECENT_MESSAGES)

    const after = messagesAfter(messages, "2")
    expect(after[0]?.id).toBe("3")

    const folded = foldMessage(
      message("ctx", "context", "CONTEXT UPDATE\nAttached: chapter=第一章\n## 第一章\n很长的正文")
    )
    expect(folded).toContain("第一章")
    expect(folded).not.toContain("很长的正文")
  })
})
