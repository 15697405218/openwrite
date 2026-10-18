import { beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("../db", async () => {
  const mod = await import("../test/test-db")
  return { db: mod.testDb }
})

import { eq } from "drizzle-orm"
import { chapter, chatThread, organization, project, user, volume, work } from "../db/schema"
import { applyMigrations, testDb } from "../test/test-db"
import { readSuspended } from "./chat-approval"
import type { ChatPacket } from "./chat-context"
import type { ModelRequest, ModelTurn } from "./chat-model"
import { replyInThread, resumeInThread } from "./chat-turn"
import { runWriteTool } from "./chat-write"

const NOW = new Date("2026-10-18T12:00:00.000Z")
const USER_ID = "approve-user"
const PROJECT_ID = "approve-project"
const OPEN_ID = "approve-open"
const OTHER_ID = "approve-other"

function packet(): ChatPacket {
  return {
    title: "审批测试",
    type: "novel",
    genre: "奇幻",
    currentChapter: { id: OPEN_ID, title: "第一章", text: "序幕。" },
    previousChapters: [],
    characters: [],
    locations: [],
    lore: [],
    plotThreads: [],
    summaries: [],
  }
}

function answered(message: string): ModelTurn {
  return { message, toolCalls: [], model: "test-model", provider: "custom" }
}

function appendCall(id: string, text: string, chapterId?: string): ModelTurn {
  return {
    message: "我补一句。",
    model: "test-model",
    provider: "custom",
    toolCalls: [
      {
        id,
        name: "append_to_chapter",
        arguments: JSON.stringify(chapterId ? { chapterId, text } : { text }),
      },
    ],
  }
}

function continueAfterTools(input: ModelRequest, done: string, pending: ModelTurn): ModelTurn {
  if (input.messages.some((message) => message.role === "tool")) {
    return answered(done)
  }
  return pending
}

async function chapterHtml(id: string): Promise<string> {
  const row = await testDb
    .select({ content: chapter.content })
    .from(chapter)
    .where(eq(chapter.id, id))
    .get()
  return row?.content ?? ""
}

beforeAll(async () => {
  await applyMigrations()
  await testDb.insert(user).values({
    id: USER_ID,
    name: "Approve Tester",
    email: "approve-tester@example.com",
    emailVerified: true,
    createdAt: NOW,
    updatedAt: NOW,
  })
  await testDb.insert(organization).values({
    id: "approve-org",
    name: "Approve Org",
    slug: "approve-org",
    createdAt: NOW,
    updatedAt: NOW,
  })
  await testDb.insert(project).values({
    id: PROJECT_ID,
    title: "审批测试",
    type: "novel",
    status: "draft",
    visibility: "private",
    ownerId: USER_ID,
    organizationId: "approve-org",
    createdAt: NOW,
    updatedAt: NOW,
  })
  await testDb.insert(work).values({
    id: "approve-work",
    projectId: PROJECT_ID,
    title: "审批测试",
    workType: "novel",
    createdAt: NOW,
    updatedAt: NOW,
  })
  await testDb.insert(volume).values({
    id: "approve-volume",
    workId: "approve-work",
    title: "第 1 卷",
    createdAt: NOW,
    updatedAt: NOW,
  })
  await testDb.insert(chapter).values([
    {
      id: OPEN_ID,
      title: "第一章",
      content: "<p>序幕。</p>",
      order: 1,
      workId: "approve-work",
      volumeId: "approve-volume",
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: OTHER_ID,
      title: "第二章",
      content: "<p>另一章。</p>",
      order: 2,
      workId: "approve-work",
      volumeId: "approve-volume",
      createdAt: NOW,
      updatedAt: NOW,
    },
  ])
})

describe("write approval", () => {
  it("reads a suspended turn and ignores a broken payload", () => {
    const raw = JSON.stringify({
      edits: [],
      messages: [{ role: "assistant", content: "我补一句。", toolCalls: [] }],
      pending: [
        {
          action: "append",
          arguments: '{"text":"雨停了。"}',
          chapterId: OPEN_ID,
          chapterTitle: "第一章",
          find: "",
          id: "call-1",
          name: "append_to_chapter",
          preview: "雨停了。",
        },
      ],
      preface: "我补一句。",
      resolved: [],
      round: 0,
    })
    expect(readSuspended(raw)?.pending[0]?.preview).toBe("雨停了。")
    expect(readSuspended("{")).toBeNull()
  })

  it("asks before writing, and a rejection leaves the chapter unchanged", async () => {
    await testDb.update(chapter).set({ content: "<p>序幕。</p>" }).where(eq(chapter.id, OPEN_ID))
    const paused = await replyInThread({
      complete: async (input) =>
        continueAfterTools(input, "不会用到", appendCall("call-1", "雨停了。")),
      openChapterHtml: "<p>序幕。</p>",
      openChapterId: OPEN_ID,
      packet: packet(),
      projectId: PROJECT_ID,
      summarize: async () => null,
      userId: USER_ID,
      userText: "补一句。",
    })
    expect("paused" in paused && paused.paused).toBe(true)
    if (!("paused" in paused && paused.paused)) {
      return
    }
    expect(paused.pending[0]?.chapterTitle).toBe("第一章")
    expect(paused.pending[0]?.preview).toBe("雨停了。")
    expect(await chapterHtml(OPEN_ID)).toBe("<p>序幕。</p>")

    const blocked = await replyInThread({
      complete: async () => answered("不该发送"),
      packet: packet(),
      projectId: PROJECT_ID,
      summarize: async () => null,
      userId: USER_ID,
      userText: "再写一点",
    })
    expect("code" in blocked && blocked.code).toBe("pending_write")

    const resumed = await resumeInThread({
      complete: async (input) =>
        continueAfterTools(input, "好，先不改。", appendCall("call-1", "雨停了。")),
      decisions: [{ id: "call-1", approved: false }],
      openChapterHtml: "<p>序幕。</p>",
      openChapterId: OPEN_ID,
      packet: packet(),
      projectId: PROJECT_ID,
      userId: USER_ID,
    })
    expect("message" in resumed && resumed.message).toBe("好，先不改。")
    expect(await chapterHtml(OPEN_ID)).toBe("<p>序幕。</p>")
  })

  it("writes the open chapter immediately when this chat allows it", async () => {
    await testDb.update(chapter).set({ content: "<p>序幕。</p>" }).where(eq(chapter.id, OPEN_ID))
    const written = await replyInThread({
      allowCurrentChapter: true,
      complete: async (input) =>
        continueAfterTools(input, "写好了。", appendCall("call-direct", "雨停了。")),
      openChapterHtml: "<p>序幕。</p>",
      openChapterId: OPEN_ID,
      packet: packet(),
      projectId: PROJECT_ID,
      summarize: async () => null,
      userId: USER_ID,
      userText: "直接补上。",
    })
    expect("paused" in written && written.paused).toBe(false)
    expect("message" in written && written.message).toBe("写好了。")
    expect(await chapterHtml(OPEN_ID)).toContain("雨停了。")
  })

  it("still asks before writing a chapter that is not the open one", async () => {
    await testDb.update(chapter).set({ content: "<p>另一章。</p>" }).where(eq(chapter.id, OTHER_ID))
    const paused = await replyInThread({
      allowCurrentChapter: true,
      complete: async (input) =>
        continueAfterTools(input, "不会用到", appendCall("call-other", "远处一声钟。", OTHER_ID)),
      openChapterHtml: "<p>序幕。</p>",
      openChapterId: OPEN_ID,
      packet: packet(),
      projectId: PROJECT_ID,
      summarize: async () => null,
      userId: USER_ID,
      userText: "给第二章补一句。",
    })
    expect("paused" in paused && paused.paused).toBe(true)
    expect(await chapterHtml(OTHER_ID)).toBe("<p>另一章。</p>")

    const resumed = await resumeInThread({
      complete: async (input) =>
        continueAfterTools(
          input,
          "第二章补上了。",
          appendCall("call-other", "远处一声钟。", OTHER_ID)
        ),
      decisions: [{ id: "call-other", approved: true }],
      openChapterHtml: "<p>序幕。</p>",
      openChapterId: OPEN_ID,
      packet: packet(),
      projectId: PROJECT_ID,
      userId: USER_ID,
    })
    expect("message" in resumed && resumed.message).toBe("第二章补上了。")
    expect(await chapterHtml(OTHER_ID)).toContain("远处一声钟。")
  })

  it("does not append twice when the same tool call is replayed", async () => {
    await testDb.update(chapter).set({ content: "<p>序幕。</p>" }).where(eq(chapter.id, OPEN_ID))
    const existing = await testDb
      .select({ id: chatThread.id })
      .from(chatThread)
      .where(eq(chatThread.projectId, PROJECT_ID))
      .get()
    const threadId = existing?.id ?? "receipt-thread"
    if (!existing) {
      await testDb.insert(chatThread).values({
        id: threadId,
        projectId: PROJECT_ID,
        userId: USER_ID,
        createdAt: NOW,
        updatedAt: NOW,
      })
    }
    const first: { chapterId: string; content: string; updatedAt: string }[] = []
    await runWriteTool({
      arguments: JSON.stringify({ text: "只写一次。" }),
      edits: first,
      name: "append_to_chapter",
      openChapterHtml: "<p>序幕。</p>",
      openChapterId: OPEN_ID,
      projectId: PROJECT_ID,
      receiptId: "receipt-call",
      threadId,
    })
    const once = await chapterHtml(OPEN_ID)
    const replay: { chapterId: string; content: string; updatedAt: string }[] = []
    await runWriteTool({
      arguments: JSON.stringify({ text: "只写一次。" }),
      edits: replay,
      name: "append_to_chapter",
      openChapterHtml: once,
      openChapterId: OPEN_ID,
      projectId: PROJECT_ID,
      receiptId: "receipt-call",
      threadId,
    })
    expect(once).toContain("只写一次。")
    expect(await chapterHtml(OPEN_ID)).toBe(once)
  })
})
