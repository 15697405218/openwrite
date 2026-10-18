import { and, asc, desc, eq } from "drizzle-orm"
import { db } from "../db"
import { chatMessage, chatThread } from "../db/schema"
import { type PublicWriteProposal, presentProposal, readSuspended } from "./chat-approval"
import { readCutoff } from "./chat-continue"
import type { StoredChatMessage } from "./chat-memory"

export interface VisibleChatMessage {
  content: string
  createdAt: string
  id: string
  role: "assistant" | "user"
}

type ThreadRow = typeof chatThread.$inferSelect

function storedRole(role: string): StoredChatMessage["role"] | null {
  if (role === "user" || role === "assistant" || role === "context") {
    return role
  }
  return null
}

export async function ensureChatThread(projectId: string, userId: string): Promise<ThreadRow> {
  const existing = await db
    .select()
    .from(chatThread)
    .where(and(eq(chatThread.projectId, projectId), eq(chatThread.userId, userId)))
    .get()
  if (existing) {
    return existing
  }
  const now = new Date()
  const id = crypto.randomUUID()
  await db.insert(chatThread).values({
    id,
    projectId,
    userId,
    createdAt: now,
    updatedAt: now,
  })
  const created = await db.select().from(chatThread).where(eq(chatThread.id, id)).get()
  if (!created) {
    throw new Error("Failed to create the chat thread")
  }
  return created
}

export async function listThreadMessages(threadId: string): Promise<StoredChatMessage[]> {
  const rows = await db
    .select({
      id: chatMessage.id,
      role: chatMessage.role,
      content: chatMessage.content,
    })
    .from(chatMessage)
    .where(eq(chatMessage.threadId, threadId))
    .orderBy(asc(chatMessage.position))
  const messages: StoredChatMessage[] = []
  for (const row of rows) {
    const role = storedRole(row.role)
    if (role) {
      messages.push({ id: row.id, role, content: row.content })
    }
  }
  return messages
}

async function nextPosition(threadId: string): Promise<number> {
  const rows = await db
    .select({ position: chatMessage.position })
    .from(chatMessage)
    .where(eq(chatMessage.threadId, threadId))
    .orderBy(desc(chatMessage.position))
    .limit(1)
  return (rows.at(0)?.position ?? 0) + 1
}

export async function insertChatMessage(
  threadId: string,
  role: StoredChatMessage["role"],
  content: string
): Promise<StoredChatMessage> {
  const id = crypto.randomUUID()
  const now = new Date()
  await db.insert(chatMessage).values({
    id,
    threadId,
    role,
    content,
    position: await nextPosition(threadId),
    createdAt: now,
  })
  await db.update(chatThread).set({ updatedAt: now }).where(eq(chatThread.id, threadId))
  return { id, role, content }
}

export async function deleteChatMessage(id: string): Promise<void> {
  await db.delete(chatMessage).where(eq(chatMessage.id, id))
}

export async function saveChatSummary(
  threadId: string,
  summary: string,
  summarizedThroughId: string
): Promise<void> {
  await db
    .update(chatThread)
    .set({ summary, summarizedThroughId, updatedAt: new Date() })
    .where(eq(chatThread.id, threadId))
}

export async function saveChatPending(threadId: string, pending: string | null): Promise<void> {
  await db
    .update(chatThread)
    .set({ pending, updatedAt: new Date() })
    .where(eq(chatThread.id, threadId))
}

export async function readChatPause(
  projectId: string,
  userId: string
): Promise<{ continuation: boolean; pending: PublicWriteProposal[]; preface: string }> {
  const thread = await db
    .select({ pending: chatThread.pending })
    .from(chatThread)
    .where(and(eq(chatThread.projectId, projectId), eq(chatThread.userId, userId)))
    .get()
  const pending = thread?.pending ?? null
  const suspended = readSuspended(pending)
  if (!suspended) {
    return { continuation: readCutoff(pending) !== null, pending: [], preface: "" }
  }
  return {
    continuation: false,
    pending: suspended.pending.map(presentProposal),
    preface: suspended.preface,
  }
}

export async function saveChatFingerprint(
  threadId: string,
  contextFingerprint: string
): Promise<void> {
  await db
    .update(chatThread)
    .set({ contextFingerprint, updatedAt: new Date() })
    .where(eq(chatThread.id, threadId))
}

export async function listVisibleChat(
  projectId: string,
  userId: string
): Promise<VisibleChatMessage[]> {
  const thread = await db
    .select({ id: chatThread.id })
    .from(chatThread)
    .where(and(eq(chatThread.projectId, projectId), eq(chatThread.userId, userId)))
    .get()
  if (!thread) {
    return []
  }
  const rows = await db
    .select({
      id: chatMessage.id,
      role: chatMessage.role,
      content: chatMessage.content,
      createdAt: chatMessage.createdAt,
    })
    .from(chatMessage)
    .where(eq(chatMessage.threadId, thread.id))
    .orderBy(asc(chatMessage.position))
  const visible: VisibleChatMessage[] = []
  for (const row of rows) {
    if (row.role === "user" || row.role === "assistant") {
      visible.push({
        id: row.id,
        role: row.role,
        content: row.content,
        createdAt: row.createdAt.toISOString(),
      })
    }
  }
  return visible
}
