import { beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("../db", async () => {
  const mod = await import("../test/test-db")
  return { db: mod.testDb }
})

import { asc, eq } from "drizzle-orm"
import { chatMessage, chatThread, organization, project, user } from "../db/schema"
import { applyMigrations, testDb } from "../test/test-db"
import type { ChatPacket } from "./chat-context"
import { CUTOFF_CONTINUE } from "./chat-continue"
import type { ModelTurn } from "./chat-model"
import { replyInThread } from "./chat-turn"

const NOW = new Date("2026-10-18T12:00:00.000Z")
const USER_ID = "chat-user"
const PROJECT_ID = "chat-project"

function packet(chapterText: string): ChatPacket {
  return {
    title: "绑定测试",
    type: "novel",
    genre: "奇幻",
    currentChapter: { id: "ch-1", title: "第一章", text: chapterText },
    previousChapters: [],
    characters: [{ id: "char-1", name: "林晚", text: "CHARACTER_BODY_UNIQUE" }],
    locations: [],
    lore: [],
    plotThreads: [],
    summaries: [],
  }
}

function answered(message: string): ModelTurn {
  return { message, toolCalls: [], model: "test-model", provider: "custom" }
}

beforeAll(async () => {
  await applyMigrations()
  await testDb.insert(user).values({
    id: USER_ID,
    name: "Chat Tester",
    email: "chat-tester@example.com",
    emailVerified: true,
    createdAt: NOW,
    updatedAt: NOW,
  })
  await testDb.insert(organization).values({
    id: "chat-org",
    name: "Chat Org",
    slug: "chat-org",
    createdAt: NOW,
    updatedAt: NOW,
  })
  await testDb.insert(project).values({
    id: PROJECT_ID,
    title: "绑定测试",
    type: "novel",
    status: "draft",
    visibility: "private",
    ownerId: USER_ID,
    organizationId: "chat-org",
    createdAt: NOW,
    updatedAt: NOW,
  })
})

describe("replyInThread", () => {
  it("stores the thread on the book and skips an unchanged context packet", async () => {
    const summarize = vi.fn(async () => "不会用到")
    const first = await replyInThread({
      complete: async () => answered("第一答"),
      packet: packet("CHAPTER_ONE"),
      projectId: PROJECT_ID,
      summarize,
      userId: USER_ID,
      userText: "这一章在写什么？",
    })
    expect("message" in first && first.message).toBe("第一答")

    await replyInThread({
      complete: async () => answered("第二答"),
      packet: packet("CHAPTER_ONE"),
      projectId: PROJECT_ID,
      summarize,
      userId: USER_ID,
      userText: "接着写",
    })

    const thread = await testDb
      .select()
      .from(chatThread)
      .where(eq(chatThread.projectId, PROJECT_ID))
      .get()
    const rows = await testDb
      .select()
      .from(chatMessage)
      .where(eq(chatMessage.threadId, thread?.id ?? ""))
    const contexts = rows.filter((row) => row.role === "context")
    expect(contexts).toHaveLength(1)
    expect(contexts[0]?.content).toContain("CHAPTER_ONE")
    expect(rows.filter((row) => row.role === "user")).toHaveLength(2)
    expect(summarize).not.toHaveBeenCalled()
  })

  it("sends only the changed chapter on the next turn", async () => {
    await replyInThread({
      complete: async () => answered("第三答"),
      packet: packet("CHAPTER_TWO"),
      projectId: PROJECT_ID,
      summarize: async () => null,
      userId: USER_ID,
      userText: "改口了",
    })
    const thread = await testDb
      .select()
      .from(chatThread)
      .where(eq(chatThread.projectId, PROJECT_ID))
      .get()
    const rows = await testDb
      .select()
      .from(chatMessage)
      .where(eq(chatMessage.threadId, thread?.id ?? ""))
      .orderBy(asc(chatMessage.position))
    const contexts = rows.filter((row) => row.role === "context")
    expect(contexts).toHaveLength(2)
    expect(contexts[1]?.content).toContain("CHAPTER_TWO")
    expect(contexts[1]?.content).not.toContain("CHARACTER_BODY_UNIQUE")
  })

  it("continues a reply cut off by the token limit", async () => {
    let calls = 0
    const result = await replyInThread({
      complete: (input) => {
        calls += 1
        if (calls === 1) {
          return Promise.resolve({
            message: "半句",
            model: "test-model",
            provider: "custom",
            toolCalls: [],
            truncated: true,
          })
        }
        expect(input.messages.at(-1)?.content).toBe(CUTOFF_CONTINUE)
        return Promise.resolve(answered("写完了。"))
      },
      packet: packet("CHAPTER_ONE"),
      projectId: PROJECT_ID,
      summarize: async () => null,
      userId: USER_ID,
      userText: "接着把句子写完",
    })
    expect("message" in result && result.message).toBe("半句写完了。")
    expect(calls).toBe(2)
  })
})
