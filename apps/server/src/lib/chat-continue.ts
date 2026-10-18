import type { ModelToolCall, ProviderMessage } from "./chat-model"
import type { ChapterEdit } from "./chat-write"

export const CUTOFF_CONTINUE = "Continue from the cutoff. Do not repeat text already written."

export const MAX_LENGTH_CONTINUATIONS = 4

export interface CutoffCheckpoint {
  edits: ChapterEdit[]
  history: ProviderMessage[]
  kind: "cutoff"
  openChapterHtml?: string
  openChapterId?: string
  round: number
  runId?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function toolArgumentsReady(calls: ModelToolCall[]): boolean {
  if (calls.length === 0) {
    return false
  }
  for (const call of calls) {
    try {
      JSON.parse(call.arguments)
    } catch {
      return false
    }
  }
  return true
}

export function cutoffHistory(origin: ProviderMessage[], partial: string): ProviderMessage[] {
  return origin.concat([
    { role: "assistant", content: partial },
    { role: "user", content: CUTOFF_CONTINUE },
  ])
}

export function splitCutoff(history: ProviderMessage[]): {
  carried: string
  origin: ProviderMessage[]
} {
  const tail = history.at(-1)
  const prior = history.at(-2)
  if (
    tail?.role === "user" &&
    tail.content === CUTOFF_CONTINUE &&
    prior?.role === "assistant" &&
    !prior.toolCalls
  ) {
    return { carried: prior.content, origin: history.slice(0, -2) }
  }
  return { carried: "", origin: history }
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
  return message
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

export function readCutoff(raw: string | null): CutoffCheckpoint | null {
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed) || parsed.kind !== "cutoff" || typeof parsed.round !== "number") {
      return null
    }
    const history = readList(parsed.history, readMessage)
    const edits = readList(parsed.edits ?? [], readEdit)
    if (!(history && edits) || history.length === 0) {
      return null
    }
    return {
      edits,
      history,
      kind: "cutoff",
      openChapterHtml:
        typeof parsed.openChapterHtml === "string" ? parsed.openChapterHtml : undefined,
      openChapterId: typeof parsed.openChapterId === "string" ? parsed.openChapterId : undefined,
      round: parsed.round,
      runId: typeof parsed.runId === "string" ? parsed.runId : undefined,
    }
  } catch {
    return null
  }
}
