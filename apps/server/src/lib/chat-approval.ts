import type { ProviderMessage } from "./chat-model"
import type { ChapterEdit } from "./chat-write"

export const WRITER_DECLINED = "作者拒绝了这次写入。不要改稿，可以改口或另提一版。"

export interface WriteProposal {
  action: "append" | "replace"
  arguments: string
  chapterId: string
  chapterTitle: string
  find: string
  id: string
  name: "append_to_chapter" | "replace_in_chapter"
  preview: string
}

export interface PublicWriteProposal {
  action: "append" | "replace"
  chapterId: string
  chapterTitle: string
  find: string
  id: string
  preview: string
}

export interface ResolvedCall {
  content: string
  id: string
}

export interface SuspendedTurn {
  edits: ChapterEdit[]
  messages: ProviderMessage[]
  openChapterHtml?: string
  openChapterId?: string
  pending: WriteProposal[]
  preface: string
  resolved: ResolvedCall[]
  round: number
  runId?: string
}

export interface WriteDecision {
  approved: boolean
  id: string
}

export function presentProposal(proposal: WriteProposal): PublicWriteProposal {
  return {
    action: proposal.action,
    chapterId: proposal.chapterId,
    chapterTitle: proposal.chapterTitle,
    find: proposal.find,
    id: proposal.id,
    preview: proposal.preview,
  }
}

export function latestOpenHtml(
  edits: ChapterEdit[],
  chapterId: string | undefined,
  fallback?: string
): string | undefined {
  if (!chapterId) {
    return fallback
  }
  const match = edits.findLast((edit) => edit.chapterId === chapterId)
  return match ? match.content : fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function readProposal(value: unknown): WriteProposal | null {
  if (!isRecord(value)) {
    return null
  }
  if (
    (value.action !== "append" && value.action !== "replace") ||
    (value.name !== "append_to_chapter" && value.name !== "replace_in_chapter") ||
    typeof value.arguments !== "string" ||
    typeof value.chapterId !== "string" ||
    typeof value.chapterTitle !== "string" ||
    typeof value.find !== "string" ||
    typeof value.id !== "string" ||
    typeof value.preview !== "string"
  ) {
    return null
  }
  return {
    action: value.action,
    arguments: value.arguments,
    chapterId: value.chapterId,
    chapterTitle: value.chapterTitle,
    find: value.find,
    id: value.id,
    name: value.name,
    preview: value.preview,
  }
}

function readMessage(value: unknown): ProviderMessage | null {
  if (!isRecord(value) || typeof value.content !== "string") {
    return null
  }
  if (value.role !== "assistant" && value.role !== "tool" && value.role !== "user") {
    return null
  }
  const message: ProviderMessage = { role: value.role, content: value.content }
  if (typeof value.toolCallId === "string") {
    message.toolCallId = value.toolCallId
  }
  if (Array.isArray(value.toolCalls)) {
    const toolCalls: { arguments: string; id: string; name: string }[] = []
    for (const call of value.toolCalls) {
      if (
        !isRecord(call) ||
        typeof call.id !== "string" ||
        typeof call.name !== "string" ||
        typeof call.arguments !== "string"
      ) {
        return null
      }
      toolCalls.push({ id: call.id, name: call.name, arguments: call.arguments })
    }
    message.toolCalls = toolCalls
  }
  return message
}

function readList<T>(value: unknown, read: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  const items: T[] = []
  for (const item of value) {
    const parsed = read(item)
    if (!parsed) {
      return null
    }
    items.push(parsed)
  }
  return items
}

function readResolved(value: unknown): ResolvedCall | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.content !== "string") {
    return null
  }
  return { id: value.id, content: value.content }
}

function readEdit(value: unknown): ChapterEdit | null {
  if (
    !isRecord(value) ||
    typeof value.chapterId !== "string" ||
    typeof value.content !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    return null
  }
  return { chapterId: value.chapterId, content: value.content, updatedAt: value.updatedAt }
}

export function readSuspended(raw: string | null): SuspendedTurn | null {
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) {
      return null
    }
    const messages = readList(parsed.messages, readMessage)
    const pending = readList(parsed.pending, readProposal)
    const resolved = readList(parsed.resolved ?? [], readResolved)
    const edits = readList(parsed.edits ?? [], readEdit)
    if (!(messages && pending && resolved && edits)) {
      return null
    }
    if (typeof parsed.round !== "number" || typeof parsed.preface !== "string") {
      return null
    }
    return {
      edits,
      messages,
      openChapterHtml:
        typeof parsed.openChapterHtml === "string" ? parsed.openChapterHtml : undefined,
      openChapterId: typeof parsed.openChapterId === "string" ? parsed.openChapterId : undefined,
      pending,
      preface: parsed.preface,
      resolved,
      round: parsed.round,
      runId: typeof parsed.runId === "string" ? parsed.runId : undefined,
    }
  } catch {
    return null
  }
}
