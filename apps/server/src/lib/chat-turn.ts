import {
  latestOpenHtml,
  type PublicWriteProposal,
  presentProposal,
  type ResolvedCall,
  readSuspended,
  type SuspendedTurn,
  WRITER_DECLINED,
  type WriteDecision,
  type WriteProposal,
} from "./chat-approval"
import type { ChatPacket } from "./chat-context"
import { contextUpdate, readFingerprint } from "./chat-context-diff"
import {
  cutoffHistory,
  MAX_LENGTH_CONTINUATIONS,
  readCutoff,
  splitCutoff,
  toolArgumentsReady,
} from "./chat-continue"
import { type ChatGraphOutcome, deleteChatRun, resumeChatGraph, runChatGraph } from "./chat-graph"
import { foldMessages, messagesAfter, overflowSplit, type StoredChatMessage } from "./chat-memory"
import type { ModelRequest, ModelToolCall, ModelTurn, ProviderMessage } from "./chat-model"
import { turnFailed } from "./chat-model"
import {
  deleteChatMessage,
  ensureChatThread,
  insertChatMessage,
  listThreadMessages,
  listVisibleChat,
  saveChatFingerprint,
  saveChatPending,
  saveChatSummary,
  type VisibleChatMessage,
} from "./chat-store"
import { type ManuscriptTool, manuscriptTools } from "./chat-tool-schema"
import { executeChatTool } from "./chat-tools"
import { type ChapterEdit, describeWrite } from "./chat-write"
import { readPrompt } from "./prompt-files"

const MAX_TOOL_ROUNDS = 8
const MAX_USER_CHARS = 8000

interface ThreadState {
  summary: string | null
  throughId: string | null
}

interface CompleteTurn {
  message: string
  model: string | null
  provider: string
}

export function chatSystemPrompt(packet: ChatPacket, summary: string | null): string {
  const lines = [
    readPrompt("chat-system"),
    "",
    readPrompt("chat-tools"),
    "",
    `Book: ${packet.title} (${packet.type})`,
  ]
  if (packet.genre) {
    lines.push(`Genre: ${packet.genre}`)
  }
  const prior = summary?.trim() ?? ""
  if (prior.length > 0) {
    lines.push("", "EARLIER CONVERSATION SUMMARY:", prior)
  }
  return lines.join("\n")
}

function toProviderHistory(messages: StoredChatMessage[]): ProviderMessage[] {
  return messages.map((message) => {
    if (message.role === "context") {
      return {
        role: "user" as const,
        content: `Manuscript context update (not a user message):\n${message.content}`,
      }
    }
    return { role: message.role, content: message.content }
  })
}

async function compactThread(
  threadId: string,
  state: ThreadState,
  summarize: (previous: string, folded: string) => Promise<string | null>
): Promise<ThreadState> {
  const live = messagesAfter(await listThreadMessages(threadId), state.throughId)
  const split = overflowSplit(live)
  const last = split?.overflow.at(-1)
  if (!(split && last)) {
    return state
  }
  const next = await summarize(state.summary ?? "", foldMessages(split.overflow))
  const summary = next?.trim() ?? ""
  if (summary.length === 0) {
    return state
  }
  await saveChatSummary(threadId, summary, last.id)
  return { summary, throughId: last.id }
}

async function attachContext(
  threadId: string,
  packet: ChatPacket,
  previousRaw: string | null,
  visible: StoredChatMessage[]
): Promise<void> {
  const previous = visible.some((message) => message.role === "context")
    ? readFingerprint(previousRaw)
    : null
  const update = contextUpdate(previous, packet)
  if (!update.text) {
    return
  }
  await insertChatMessage(threadId, "context", update.text)
  await saveChatFingerprint(threadId, JSON.stringify(update.fingerprint))
}

async function reattachIfMissing(
  threadId: string,
  packet: ChatPacket,
  throughId: string | null
): Promise<StoredChatMessage[]> {
  let live = messagesAfter(await listThreadMessages(threadId), throughId)
  if (live.some((message) => message.role === "context")) {
    return live
  }
  const update = contextUpdate(null, packet)
  if (!update.text) {
    return live
  }
  await insertChatMessage(threadId, "context", update.text)
  await saveChatFingerprint(threadId, JSON.stringify(update.fingerprint))
  live = messagesAfter(await listThreadMessages(threadId), throughId)
  return live
}

interface LoopOptions {
  allowCurrentChapter?: boolean
  complete: (input: ModelRequest) => Promise<ModelTurn>
  edits: ChapterEdit[]
  history: ProviderMessage[]
  openChapterHtml?: string
  openChapterId?: string
  projectId: string
  saveCutoff?: (round: number, history: ProviderMessage[]) => Promise<void>
  startRound?: number
  system: string
}

interface LoopFailure {
  code?: "no_pending" | "no_provider"
  error: string
  status: 400 | 409 | 412 | 500 | 502
}

type LoopResult = CompleteTurn | LoopFailure | { suspended: SuspendedTurn }

export type ThreadTurn =
  | {
      edits: ChapterEdit[]
      message: string
      messages: VisibleChatMessage[]
      model: string | null
      paused: boolean
      pending: PublicWriteProposal[]
      preface: string
      provider: string
    }
  | {
      code?: "no_pending" | "no_provider" | "pending_continuation" | "pending_write"
      edits: ChapterEdit[]
      error: string
      status: 400 | 409 | 412 | 500 | 502
    }

async function classifyCall(
  call: ModelToolCall,
  options: LoopOptions,
  html: string | undefined
): Promise<{ content: string } | { proposal: WriteProposal }> {
  const described = await describeWrite({
    arguments: call.arguments,
    id: call.id,
    name: call.name,
    openChapterHtml: html,
    openChapterId: options.openChapterId,
    projectId: options.projectId,
  })
  if (!described || "content" in described) {
    if (described && "content" in described) {
      return described
    }
    return {
      content: await executeChatTool({
        arguments: call.arguments,
        edits: options.edits,
        name: call.name,
        openChapterHtml: html,
        openChapterId: options.openChapterId,
        projectId: options.projectId,
      }),
    }
  }
  const chapterWrite =
    described.proposal.name === "append_to_chapter" ||
    described.proposal.name === "replace_in_chapter"
  const allowed =
    options.allowCurrentChapter === true &&
    chapterWrite &&
    described.proposal.chapterId === options.openChapterId
  if (!allowed) {
    return described
  }
  return {
    content: await executeChatTool({
      arguments: call.arguments,
      edits: options.edits,
      name: call.name,
      openChapterHtml: html,
      openChapterId: options.openChapterId,
      projectId: options.projectId,
    }),
  }
}

async function settleCalls(
  calls: ModelToolCall[],
  options: LoopOptions
): Promise<{ pending: WriteProposal[]; resolved: ResolvedCall[] }> {
  let html = options.openChapterHtml
  const pending: WriteProposal[] = []
  const resolved: ResolvedCall[] = []
  for (const call of calls) {
    const outcome = await classifyCall(call, options, html)
    if ("proposal" in outcome) {
      pending.push(outcome.proposal)
      continue
    }
    resolved.push({ id: call.id, content: outcome.content })
    html = latestOpenHtml(options.edits, options.openChapterId, html)
  }
  return { pending, resolved }
}

function toolResults(calls: ModelToolCall[], resolved: ResolvedCall[]): ProviderMessage[] {
  const results: ProviderMessage[] = []
  for (const call of calls) {
    const found = resolved.find((item) => item.id === call.id)
    results.push({ role: "tool", toolCallId: call.id, content: found?.content ?? "" })
  }
  return results
}

async function completeUntilStop(
  options: LoopOptions,
  round: number,
  history: ProviderMessage[],
  tools: ManuscriptTool[] | undefined
): Promise<ModelTurn> {
  const split = splitCutoff(history)
  let turn = await options.complete({ system: options.system, messages: history, tools })
  let accumulated = split.carried
  let hops = 0
  while (!turnFailed(turn)) {
    accumulated += turn.message
    const ready = toolArgumentsReady(turn.toolCalls)
    if (!turn.truncated || ready) {
      return { ...turn, message: accumulated }
    }
    if (hops >= MAX_LENGTH_CONTINUATIONS || accumulated.length === 0) {
      return { ...turn, message: accumulated, toolCalls: [] }
    }
    hops += 1
    const nextHistory = cutoffHistory(split.origin, accumulated)
    if (options.saveCutoff) {
      await options.saveCutoff(round, nextHistory)
    }
    turn = await options.complete({ system: options.system, messages: nextHistory, tools })
  }
  if (accumulated.length > 0) {
    return { ...turn, error: undefined, message: accumulated, status: undefined, toolCalls: [] }
  }
  return turn
}

async function runToolLoop(options: LoopOptions): Promise<LoopResult> {
  let messages = options.history
  const start = options.startRound ?? 0
  for (let round = start; round <= MAX_TOOL_ROUNDS; round += 1) {
    const tools = round < MAX_TOOL_ROUNDS ? manuscriptTools : undefined
    const turn = await completeUntilStop(options, round, messages, tools)
    if (turnFailed(turn)) {
      return {
        error: turn.error ?? "Failed to reach the AI provider",
        status: turn.status ?? 502,
        code: turn.code,
      }
    }
    if (turn.toolCalls.length === 0) {
      if (turn.message.trim().length === 0) {
        return { error: "Provider returned no content", status: 502 }
      }
      return {
        message: turn.message,
        model: turn.model ?? null,
        provider: turn.provider ?? "",
      }
    }
    const settled = await settleCalls(turn.toolCalls, options)
    const assistant: ProviderMessage = {
      role: "assistant",
      content: turn.message,
      toolCalls: turn.toolCalls,
    }
    if (settled.pending.length > 0) {
      return {
        suspended: {
          edits: options.edits,
          messages: messages.concat([assistant]),
          openChapterHtml: options.openChapterHtml,
          openChapterId: options.openChapterId,
          pending: settled.pending,
          preface: turn.message.trim(),
          resolved: settled.resolved,
          round,
        },
      }
    }
    messages = messages.concat([assistant], toolResults(turn.toolCalls, settled.resolved))
  }
  return { error: "Provider returned no content", status: 502 }
}

async function finishRecorded(
  threadId: string,
  projectId: string,
  userId: string,
  runId: string,
  outcome: ChatGraphOutcome,
  userMessageId?: string
): Promise<ThreadTurn> {
  if (!("suspended" in outcome.result)) {
    await deleteChatRun(runId)
  }
  return await finishTurn(threadId, projectId, userId, outcome.result, outcome.edits, userMessageId)
}

async function finishTurn(
  threadId: string,
  projectId: string,
  userId: string,
  answered: LoopResult,
  edits: ChapterEdit[],
  userMessageId?: string
): Promise<ThreadTurn> {
  if ("suspended" in answered) {
    await saveChatPending(threadId, JSON.stringify(answered.suspended))
    const messages = await listVisibleChat(projectId, userId)
    return {
      edits,
      message: answered.suspended.preface,
      messages,
      model: null,
      paused: true,
      pending: answered.suspended.pending.map(presentProposal),
      preface: answered.suspended.preface,
      provider: "",
    }
  }
  if ("error" in answered) {
    if (userMessageId) {
      await deleteChatMessage(userMessageId)
    }
    await saveChatPending(threadId, null)
    return { ...answered, edits }
  }
  await saveChatPending(threadId, null)
  await insertChatMessage(threadId, "assistant", answered.message)
  return {
    edits,
    message: answered.message,
    messages: await listVisibleChat(projectId, userId),
    model: answered.model,
    paused: false,
    pending: [],
    preface: "",
    provider: answered.provider,
  }
}

function decisionsCover(pending: WriteProposal[], decisions: WriteDecision[]): boolean {
  for (const proposal of pending) {
    if (!decisions.some((decision) => decision.id === proposal.id)) {
      return false
    }
  }
  return true
}

export async function resumeInThread(options: {
  allowCurrentChapter?: boolean
  complete: (input: ModelRequest) => Promise<ModelTurn>
  decisions: WriteDecision[]
  openChapterHtml?: string
  openChapterId?: string
  packet: ChatPacket
  projectId: string
  userId: string
}): Promise<ThreadTurn> {
  const thread = await ensureChatThread(options.projectId, options.userId)
  const suspended = readSuspended(thread.pending)
  if (!suspended) {
    return {
      edits: [],
      error: "No write is waiting for confirmation",
      status: 409,
      code: "no_pending",
    }
  }
  const assistant = suspended.messages.at(-1)
  const calls = assistant?.toolCalls ?? []
  if (!assistant || calls.length === 0) {
    await saveChatPending(thread.id, null)
    return { edits: [], error: "The pending write could not be resumed", status: 500 }
  }
  if (!decisionsCover(suspended.pending, options.decisions)) {
    return { edits: [], error: "Each write needs a decision", status: 400 }
  }
  if (suspended.runId) {
    const outcome = await resumeChatGraph({
      allowCurrentChapter: options.allowCurrentChapter,
      complete: options.complete,
      decisions: options.decisions,
      openChapterHtml: options.openChapterHtml,
      openChapterId: options.openChapterId,
      projectId: options.projectId,
      runId: suspended.runId,
      system: chatSystemPrompt(options.packet, thread.summary),
      threadId: thread.id,
    })
    return await finishRecorded(
      thread.id,
      options.projectId,
      options.userId,
      suspended.runId,
      outcome
    )
  }
  const edits = [...suspended.edits]
  let html = options.openChapterHtml
  const resolved = [...suspended.resolved]
  for (const call of calls) {
    if (resolved.some((item) => item.id === call.id)) {
      continue
    }
    const decision = options.decisions.find((item) => item.id === call.id)
    const content =
      decision?.approved === true
        ? await executeChatTool({
            arguments: call.arguments,
            edits,
            name: call.name,
            openChapterHtml: html,
            openChapterId: options.openChapterId,
            projectId: options.projectId,
          })
        : JSON.stringify({ error: WRITER_DECLINED })
    resolved.push({ id: call.id, content })
    html = latestOpenHtml(edits, options.openChapterId, html)
  }
  const answered = await runToolLoop({
    allowCurrentChapter: options.allowCurrentChapter,
    complete: options.complete,
    edits,
    history: suspended.messages.concat(toolResults(calls, resolved)),
    openChapterHtml: html,
    openChapterId: options.openChapterId,
    projectId: options.projectId,
    startRound: suspended.round + 1,
    system: chatSystemPrompt(options.packet, thread.summary),
  })
  return await finishTurn(thread.id, options.projectId, options.userId, answered, edits)
}

function rememberCutoff(
  threadId: string,
  edits: ChapterEdit[],
  openChapterHtml: string | undefined,
  openChapterId: string | undefined
): (round: number, history: ProviderMessage[]) => Promise<void> {
  return async (round, history) => {
    await saveChatPending(
      threadId,
      JSON.stringify({
        edits,
        history,
        kind: "cutoff",
        openChapterHtml,
        openChapterId,
        round,
      })
    )
  }
}

export async function replyInThread(options: {
  allowCurrentChapter?: boolean
  complete: (input: ModelRequest) => Promise<ModelTurn>
  openChapterHtml?: string
  openChapterId?: string
  packet: ChatPacket
  projectId: string
  summarize: (previous: string, folded: string) => Promise<string | null>
  userId: string
  userText: string
}): Promise<ThreadTurn> {
  const thread = await ensureChatThread(options.projectId, options.userId)
  if (thread.pending && readSuspended(thread.pending)) {
    return {
      edits: [],
      error: "A write is waiting for confirmation",
      status: 409,
      code: "pending_write",
    }
  }
  if (readCutoff(thread.pending)) {
    return {
      edits: [],
      error: "A cut-off reply is still being continued",
      status: 409,
      code: "pending_continuation",
    }
  }
  if (thread.pending) {
    await saveChatPending(thread.id, null)
  }
  let state = await compactThread(
    thread.id,
    { summary: thread.summary, throughId: thread.summarizedThroughId },
    options.summarize
  )
  const before = messagesAfter(await listThreadMessages(thread.id), state.throughId)
  await attachContext(thread.id, options.packet, thread.contextFingerprint, before)
  const userMessage = await insertChatMessage(
    thread.id,
    "user",
    options.userText.slice(0, MAX_USER_CHARS)
  )
  state = await compactThread(thread.id, state, options.summarize)
  const live = await reattachIfMissing(thread.id, options.packet, state.throughId)
  const runId = crypto.randomUUID()
  const outcome = await runChatGraph({
    allowCurrentChapter: options.allowCurrentChapter,
    complete: options.complete,
    history: toProviderHistory(live),
    openChapterHtml: options.openChapterHtml,
    openChapterId: options.openChapterId,
    projectId: options.projectId,
    runId,
    system: chatSystemPrompt(options.packet, state.summary),
    threadId: thread.id,
  })
  return await finishRecorded(
    thread.id,
    options.projectId,
    options.userId,
    runId,
    outcome,
    "error" in outcome.result ? userMessage.id : undefined
  )
}

export async function resumeCutoffInThread(options: {
  allowCurrentChapter?: boolean
  complete: (input: ModelRequest) => Promise<ModelTurn>
  openChapterHtml?: string
  openChapterId?: string
  packet: ChatPacket
  projectId: string
  userId: string
}): Promise<ThreadTurn> {
  const thread = await ensureChatThread(options.projectId, options.userId)
  const checkpoint = readCutoff(thread.pending)
  if (!checkpoint) {
    return {
      edits: [],
      error: "No cut-off reply to continue",
      status: 400,
      code: "no_pending",
    }
  }
  const edits = checkpoint.edits.map((edit) => ({ ...edit }))
  const openChapterHtml = options.openChapterHtml ?? checkpoint.openChapterHtml
  const openChapterId = options.openChapterId ?? checkpoint.openChapterId
  if (checkpoint.runId) {
    const outcome = await resumeChatGraph({
      allowCurrentChapter: options.allowCurrentChapter,
      complete: options.complete,
      openChapterHtml,
      openChapterId,
      projectId: options.projectId,
      runId: checkpoint.runId,
      system: chatSystemPrompt(options.packet, thread.summary),
      threadId: thread.id,
    })
    return await finishRecorded(
      thread.id,
      options.projectId,
      options.userId,
      checkpoint.runId,
      outcome
    )
  }
  const answered = await runToolLoop({
    allowCurrentChapter: options.allowCurrentChapter,
    complete: options.complete,
    edits,
    history: checkpoint.history,
    openChapterHtml,
    openChapterId,
    projectId: options.projectId,
    saveCutoff: rememberCutoff(thread.id, edits, openChapterHtml, openChapterId),
    startRound: checkpoint.round,
    system: chatSystemPrompt(options.packet, thread.summary),
  })
  return await finishTurn(thread.id, options.projectId, options.userId, answered, edits)
}
