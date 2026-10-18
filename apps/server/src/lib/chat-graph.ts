import {
  Annotation,
  Command,
  END,
  interrupt,
  isGraphInterrupt,
  isInterrupted,
  type LangGraphRunnableConfig,
  START,
  StateGraph,
} from "@langchain/langgraph"
import {
  latestOpenHtml,
  type SuspendedTurn,
  WRITER_DECLINED,
  type WriteDecision,
  type WriteProposal,
} from "./chat-approval"
import { chatCheckpointer } from "./chat-checkpointer"
import {
  CUTOFF_CONTINUE,
  cutoffHistory,
  MAX_LENGTH_CONTINUATIONS,
  splitCutoff,
  toolArgumentsReady,
} from "./chat-continue"
import type { ModelRequest, ModelToolCall, ModelTurn, ProviderMessage } from "./chat-model"
import { turnFailed } from "./chat-model"
import { saveChatPending } from "./chat-store"
import { manuscriptTools } from "./chat-tool-schema"
import { executeChatTool } from "./chat-tools"
import { type ChapterEdit, describeWrite } from "./chat-write"

const MAX_TOOL_ROUNDS = 8

interface ChatGraphState {
  code: "no_provider" | null
  edits: ChapterEdit[]
  error: string | null
  hops: number
  messages: ProviderMessage[]
  model: string | null
  openChapterHtml: string | null
  openChapterId: string | null
  provider: string
  round: number
  status: number | null
}

function keep<T>(current: T, next: T): T {
  return next === undefined ? current : next
}

const GraphState = Annotation.Root({
  code: Annotation<"no_provider" | null>({ reducer: keep, default: () => null }),
  edits: Annotation<ChapterEdit[]>({ reducer: keep, default: () => [] }),
  error: Annotation<string | null>({ reducer: keep, default: () => null }),
  hops: Annotation<number>({ reducer: keep, default: () => 0 }),
  messages: Annotation<ProviderMessage[]>({ reducer: keep, default: () => [] }),
  model: Annotation<string | null>({ reducer: keep, default: () => null }),
  openChapterHtml: Annotation<string | null>({ reducer: keep, default: () => null }),
  openChapterId: Annotation<string | null>({ reducer: keep, default: () => null }),
  provider: Annotation<string>({ reducer: keep, default: () => "" }),
  round: Annotation<number>({ reducer: keep, default: () => 0 }),
  status: Annotation<number | null>({ reducer: keep, default: () => null }),
})

interface RunConfig {
  allowCurrentChapter: boolean
  complete: (input: ModelRequest) => Promise<ModelTurn>
  projectId: string
  runId: string
  system: string
  threadId: string
}

export type ChatGraphResult =
  | {
      code?: "no_pending" | "no_provider"
      error: string
      status: 400 | 409 | 412 | 500 | 502
    }
  | { message: string; model: string | null; provider: string }
  | { suspended: SuspendedTurn }

export interface ChatGraphOutcome {
  edits: ChapterEdit[]
  result: ChatGraphResult
}

export interface GraphRunOptions {
  allowCurrentChapter?: boolean
  complete: (input: ModelRequest) => Promise<ModelTurn>
  decisions?: WriteDecision[]
  edits?: ChapterEdit[]
  history?: ProviderMessage[]
  openChapterHtml?: string
  openChapterId?: string
  projectId: string
  round?: number
  runId: string
  system: string
  threadId: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isComplete(value: unknown): value is RunConfig["complete"] {
  return typeof value === "function"
}

function readRun(config: LangGraphRunnableConfig): RunConfig {
  const raw = config.configurable ?? {}
  if (
    !isComplete(raw.complete) ||
    typeof raw.projectId !== "string" ||
    typeof raw.runId !== "string" ||
    typeof raw.system !== "string" ||
    typeof raw.threadId !== "string"
  ) {
    throw new Error("Chat graph is missing its model caller")
  }
  return {
    allowCurrentChapter: raw.allowCurrentChapter === true,
    complete: raw.complete,
    projectId: raw.projectId,
    runId: raw.runId,
    system: raw.system,
    threadId: raw.threadId,
  }
}

function graphConfig(options: GraphRunOptions) {
  return {
    recursionLimit: 40,
    configurable: {
      thread_id: options.runId,
      allowCurrentChapter: options.allowCurrentChapter === true,
      complete: options.complete,
      projectId: options.projectId,
      runId: options.runId,
      system: options.system,
      threadId: options.threadId,
    },
  }
}

async function markRunnable(config: LangGraphRunnableConfig, state: ChatGraphState): Promise<void> {
  const run = readRun(config)
  const history =
    state.messages.length > 0
      ? state.messages
      : [{ role: "user" as const, content: CUTOFF_CONTINUE }]
  await saveChatPending(
    run.threadId,
    JSON.stringify({
      edits: state.edits,
      history,
      kind: "cutoff",
      openChapterHtml: state.openChapterHtml ?? undefined,
      openChapterId: state.openChapterId ?? undefined,
      round: state.round,
      runId: run.runId,
    })
  )
}

function partialReply(state: ChatGraphState, text: string, turn: ModelTurn | null) {
  const split = splitCutoff(state.messages)
  return {
    hops: 0,
    messages: split.origin.concat([{ role: "assistant" as const, content: text }]),
    model: turn?.model ?? state.model,
    provider: turn?.provider || state.provider,
  }
}

function failedTurn(state: ChatGraphState, turn: ModelTurn) {
  const carried = splitCutoff(state.messages).carried
  if (carried.length > 0) {
    return partialReply(state, carried, turn)
  }
  return {
    code: turn.code ?? null,
    error: turn.error ?? "Failed to reach the AI provider",
    model: turn.model ?? null,
    provider: turn.provider ?? "",
    status: turn.status ?? 502,
  }
}

async function continueCutoff(
  state: ChatGraphState,
  turn: ModelTurn,
  accumulated: string,
  config: LangGraphRunnableConfig
) {
  const split = splitCutoff(state.messages)
  if (state.hops >= MAX_LENGTH_CONTINUATIONS || accumulated.length === 0) {
    return partialReply(state, accumulated, turn)
  }
  const messages = cutoffHistory(split.origin, accumulated)
  await markRunnable(config, { ...state, messages })
  return {
    hops: state.hops + 1,
    messages,
    model: turn.model ?? null,
    provider: turn.provider ?? "",
  }
}

async function acceptTurn(state: ChatGraphState, turn: ModelTurn, config: LangGraphRunnableConfig) {
  if (turnFailed(turn)) {
    return failedTurn(state, turn)
  }
  const split = splitCutoff(state.messages)
  const accumulated = split.carried + turn.message
  if (turn.truncated && !toolArgumentsReady(turn.toolCalls)) {
    return await continueCutoff(state, turn, accumulated, config)
  }
  if (turn.toolCalls.length === 0 && accumulated.trim().length === 0) {
    return {
      error: "Provider returned no content",
      model: turn.model ?? null,
      provider: turn.provider ?? "",
      status: 502,
    }
  }
  const assistant: ProviderMessage = {
    role: "assistant" as const,
    content: accumulated,
    ...(turn.toolCalls.length > 0 ? { toolCalls: turn.toolCalls } : {}),
  }
  return {
    hops: 0,
    messages: split.origin.concat([assistant]),
    model: turn.model ?? null,
    provider: turn.provider ?? "",
  }
}

async function modelNode(state: ChatGraphState, config: LangGraphRunnableConfig) {
  const run = readRun(config)
  const tools = state.round < MAX_TOOL_ROUNDS ? manuscriptTools : undefined
  try {
    const turn = await run.complete({ messages: state.messages, system: run.system, tools })
    return await acceptTurn(state, turn, config)
  } catch (error) {
    if (isGraphInterrupt(error)) {
      throw error
    }
    const carried = splitCutoff(state.messages).carried
    if (carried.length > 0) {
      return partialReply(state, carried, null)
    }
    const message = error instanceof Error ? error.message : "Failed to reach the AI provider"
    return { error: message, status: 502 }
  }
}

function afterModel(state: ChatGraphState): "draft" | "tools" | typeof END {
  if (state.error) {
    return END
  }
  const last = state.messages.at(-1)
  if (last?.role === "user" && last.content === CUTOFF_CONTINUE) {
    return "draft"
  }
  const calls = last?.role === "assistant" ? last.toolCalls : undefined
  if (calls && calls.length > 0 && state.round < MAX_TOOL_ROUNDS) {
    return "tools"
  }
  return END
}

interface PlannedCall {
  call: ModelToolCall
  content?: string
  proposal?: WriteProposal
}

async function planCall(
  call: ModelToolCall,
  state: ChatGraphState,
  run: RunConfig
): Promise<PlannedCall> {
  const described = await describeWrite({
    arguments: call.arguments,
    id: call.id,
    name: call.name,
    openChapterHtml: state.openChapterHtml ?? undefined,
    openChapterId: state.openChapterId ?? undefined,
    projectId: run.projectId,
  })
  if (!described || "content" in described) {
    return described ? { call, content: described.content } : { call }
  }
  const allowed = run.allowCurrentChapter && described.proposal.chapterId === state.openChapterId
  if (!allowed) {
    return { call, proposal: described.proposal }
  }
  return { call }
}

function readDecisions(value: unknown): WriteDecision[] {
  if (!Array.isArray(value)) {
    return []
  }
  const decisions: WriteDecision[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.approved !== "boolean") {
      return []
    }
    decisions.push({ approved: item.approved, id: item.id })
  }
  return decisions
}

function decisionApproves(decisions: WriteDecision[], id: string): boolean {
  return decisions.some((decision) => decision.id === id && decision.approved)
}

async function applyPlanned(
  plan: PlannedCall,
  decisions: WriteDecision[],
  html: string | undefined,
  edits: ChapterEdit[],
  run: RunConfig,
  openChapterId: string | null
): Promise<{ content: string; html: string | undefined }> {
  if (plan.proposal && !decisionApproves(decisions, plan.call.id)) {
    return { content: JSON.stringify({ error: WRITER_DECLINED }), html }
  }
  if (plan.content !== undefined && !plan.proposal) {
    return { content: plan.content, html }
  }
  const content = await executeChatTool({
    arguments: plan.call.arguments,
    edits,
    name: plan.call.name,
    openChapterHtml: html,
    openChapterId: openChapterId ?? undefined,
    projectId: run.projectId,
    receiptId: plan.call.id,
    threadId: run.threadId,
  })
  return {
    content,
    html: latestOpenHtml(edits, openChapterId ?? undefined, html),
  }
}

function toolMessages(
  calls: ModelToolCall[],
  resolved: { content: string; id: string }[]
): ProviderMessage[] {
  const messages: ProviderMessage[] = []
  for (const call of calls) {
    const found = resolved.find((item) => item.id === call.id)
    messages.push({ role: "tool", toolCallId: call.id, content: found?.content ?? "" })
  }
  return messages
}

async function toolsNode(state: ChatGraphState, config: LangGraphRunnableConfig) {
  const run = readRun(config)
  await markRunnable(config, state)
  const last = state.messages.at(-1)
  const calls = last?.role === "assistant" ? (last.toolCalls ?? []) : []
  const plans: PlannedCall[] = []
  for (const call of calls) {
    plans.push(await planCall(call, state, run))
  }
  const proposals = plans.flatMap((plan) => (plan.proposal ? [plan.proposal] : []))
  const resumed = proposals.length > 0 ? interrupt(proposals) : []
  const decisions = readDecisions(resumed)
  const edits = [...state.edits]
  let html = state.openChapterHtml ?? undefined
  const resolved: { content: string; id: string }[] = []
  for (const plan of plans) {
    const applied = await applyPlanned(plan, decisions, html, edits, run, state.openChapterId)
    html = applied.html
    resolved.push({ content: applied.content, id: plan.call.id })
  }
  return {
    edits,
    messages: state.messages.concat(toolMessages(calls, resolved)),
    openChapterHtml: html ?? null,
    round: state.round + 1,
  }
}

const chatGraph = new StateGraph(GraphState)
  .addNode("draft", modelNode)
  .addNode("tools", toolsNode)
  .addEdge(START, "draft")
  .addConditionalEdges("draft", afterModel, ["draft", "tools", END])
  .addEdge("tools", "draft")
  .compile({ checkpointer: chatCheckpointer })

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
  if (!Array.isArray(value.toolCalls)) {
    return message
  }
  const toolCalls: ModelToolCall[] = []
  for (const call of value.toolCalls) {
    if (
      !isRecord(call) ||
      typeof call.id !== "string" ||
      typeof call.name !== "string" ||
      typeof call.arguments !== "string"
    ) {
      return null
    }
    toolCalls.push({ arguments: call.arguments, id: call.id, name: call.name })
  }
  message.toolCalls = toolCalls
  return message
}

function readMessages(value: unknown): ProviderMessage[] {
  if (!Array.isArray(value)) {
    return []
  }
  const messages: ProviderMessage[] = []
  for (const item of value) {
    const message = readMessage(item)
    if (!message) {
      return []
    }
    messages.push(message)
  }
  return messages
}

function readEdits(value: unknown): ChapterEdit[] {
  if (!Array.isArray(value)) {
    return []
  }
  const edits: ChapterEdit[] = []
  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.chapterId !== "string" ||
      typeof item.content !== "string" ||
      typeof item.updatedAt !== "string"
    ) {
      continue
    }
    edits.push({ chapterId: item.chapterId, content: item.content, updatedAt: item.updatedAt })
  }
  return edits
}

function isProposal(value: unknown): value is WriteProposal {
  return (
    isRecord(value) &&
    (value.action === "append" || value.action === "replace") &&
    (value.name === "append_to_chapter" || value.name === "replace_in_chapter") &&
    typeof value.arguments === "string" &&
    typeof value.chapterId === "string" &&
    typeof value.chapterTitle === "string" &&
    typeof value.find === "string" &&
    typeof value.id === "string" &&
    typeof value.preview === "string"
  )
}

function readStatus(value: unknown): 400 | 409 | 412 | 500 | 502 {
  if (value === 400 || value === 409 || value === 412 || value === 500 || value === 502) {
    return value
  }
  return 502
}

function interpret(result: unknown, runId: string): ChatGraphOutcome {
  if (!isRecord(result)) {
    return { edits: [], result: { error: "Provider returned no content", status: 502 } }
  }
  const edits = readEdits(result.edits)
  const messages = readMessages(result.messages)
  const openChapterHtml =
    typeof result.openChapterHtml === "string" ? result.openChapterHtml : undefined
  const openChapterId = typeof result.openChapterId === "string" ? result.openChapterId : undefined
  const round = typeof result.round === "number" ? result.round : 0
  if (isInterrupted<unknown>(result)) {
    const proposals = result.__interrupt__.flatMap((item) =>
      Array.isArray(item.value) ? item.value.filter(isProposal) : []
    )
    const last = messages.at(-1)
    if (proposals.length === 0 || last?.role !== "assistant") {
      return { edits, result: { error: "The pending write could not be resumed", status: 500 } }
    }
    return {
      edits,
      result: {
        suspended: {
          edits,
          messages,
          openChapterHtml,
          openChapterId,
          pending: proposals,
          preface: last.content.trim(),
          resolved: [],
          round,
          runId,
        },
      },
    }
  }
  if (typeof result.error === "string") {
    return {
      edits,
      result: {
        code: result.code === "no_provider" ? "no_provider" : undefined,
        error: result.error,
        status: readStatus(result.status),
      },
    }
  }
  const reply = messages.findLast(
    (message) => message.role === "assistant" && (message.toolCalls?.length ?? 0) === 0
  )
  if (!reply || reply.content.trim().length === 0) {
    return { edits, result: { error: "Provider returned no content", status: 502 } }
  }
  return {
    edits,
    result: {
      message: reply.content,
      model: typeof result.model === "string" ? result.model : null,
      provider: typeof result.provider === "string" ? result.provider : "",
    },
  }
}

export async function runChatGraph(options: GraphRunOptions): Promise<ChatGraphOutcome> {
  const result = await chatGraph.invoke(
    {
      code: null,
      edits: options.edits ?? [],
      error: null,
      hops: 0,
      messages: options.history ?? [],
      model: null,
      openChapterHtml: options.openChapterHtml ?? null,
      openChapterId: options.openChapterId ?? null,
      provider: "",
      round: options.round ?? 0,
      status: null,
    },
    graphConfig(options)
  )
  return interpret(result, options.runId)
}

export async function resumeChatGraph(options: GraphRunOptions): Promise<ChatGraphOutcome> {
  const update: { openChapterHtml?: string | null; openChapterId?: string | null } = {}
  if (options.openChapterHtml !== undefined) {
    update.openChapterHtml = options.openChapterHtml
  }
  if (options.openChapterId !== undefined) {
    update.openChapterId = options.openChapterId
  }
  const input = (
    options.decisions
      ? new Command({
          resume: options.decisions,
          ...(Object.keys(update).length > 0 ? { update } : {}),
        })
      : null
  ) as Parameters<typeof chatGraph.invoke>[0]
  const result = await chatGraph.invoke(input, graphConfig(options))
  return interpret(result, options.runId)
}

export async function deleteChatRun(runId: string): Promise<void> {
  await chatCheckpointer.deleteThread(runId)
}
