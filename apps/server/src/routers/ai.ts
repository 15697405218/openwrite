import { and, asc, eq } from "drizzle-orm"
import { type Context, Hono } from "hono"
import { db } from "../db"
import { aiProvider } from "../db/schema"
import { summaryRequest } from "../lib/chat-memory"
import type { ModelToolCall, ProviderMessage } from "../lib/chat-model"
import { listVisibleChat, readChatPause } from "../lib/chat-store"
import type { ManuscriptTool } from "../lib/chat-tool-schema"
import { replyInThread, resumeCutoffInThread, resumeInThread } from "../lib/chat-turn"
import {
  cleanContinuation,
  deepseekCompletionExtras,
  MIN_COMPLETION_PREFIX,
  readCompletionPrefix,
} from "../lib/completion-text"
import { decryptApiKey } from "../lib/encryption"
import {
  clipImportText,
  clipKnownNames,
  emptyImportExtract,
  IMPORT_EXTRACT_MAX_TOKENS,
  importExtractPrompt,
  parseImportExtract,
} from "../lib/import-extract"
import { type ChatFocusKind, loadChatPacket } from "../lib/load-chat-context"
import {
  AUTOCOMPLETE_MAX_TOKENS,
  boundedOutputTokens,
  CHAT_MAX_TOKENS,
  CONVERSATION_SUMMARY_MAX_TOKENS,
} from "../lib/output-budget"
import { readPrompt } from "../lib/prompt-files"
import { requireAuth } from "../middleware/auth"

export interface AiRuntimeEnv {
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  CORS_ORIGIN: string
  ENCRYPTION_KEY: string
}

type Env = AiRuntimeEnv

interface Variables {
  activeOrganization: {
    id: string
    name: string
    slug: string
  } | null
  session: {
    id: string
    userId: string
  }
  user: {
    id: string
    email: string
    name: string
  }
}

type AppContext = Context<{ Bindings: Env; Variables: Variables }>

interface ChatMessage {
  content: string
  role: "user" | "assistant"
}

const MAX_MESSAGES = 40
const MAX_TOTAL_CHARS = 32_000
const MAX_OUTPUT_TOKENS = CHAT_MAX_TOKENS
const UPSTREAM_ERROR_PREVIEW_CHARS = 300
const MAX_CLIENT_CHAPTER_CHARS = 100_000

// Providers that expose an OpenAI-compatible chat completions endpoint
const OPENAI_COMPATIBLE = {
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    // Deliberately a `:free` model — `openrouter/auto` bills credits, so it 402s
    // for anyone who has not topped up. Override per provider in Dashboard → AI.
    defaultModel: "z-ai/glm-5.2:free",
  },
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o-mini",
  },
  groq: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel: "llama-3.3-70b-versatile",
  },
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    defaultModel: "gemini-2.0-flash",
  },
  cohere: {
    url: "https://api.cohere.ai/compatibility/v1/chat/completions",
    defaultModel: "command-r-08-2024",
  },
} as const

const ANTHROPIC_DEFAULT_MODEL = "claude-haiku-4-5"
const OLLAMA_DEFAULT_URL = "http://localhost:11434"
const OLLAMA_DEFAULT_MODEL = "llama3.2"
const TRAILING_SLASH_PATTERN = /\/$/
const CHAT_COMPLETIONS_SUFFIX = "/chat/completions"
const OPENROUTER_HEADERS = {
  "HTTP-Referer": "https://github.com/ilrein/openwrite",
  "X-Title": "OpenWrite",
}

function validateMessages(input: unknown): ChatMessage[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_MESSAGES) {
    return null
  }

  let totalChars = 0
  const messages: ChatMessage[] = []

  for (const item of input) {
    const role = (item as { role?: unknown }).role
    const content = (item as { content?: unknown }).content
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
      return null
    }
    totalChars += content.length
    messages.push({ role, content })
  }

  if (totalChars > MAX_TOTAL_CHARS || messages.at(-1)?.role !== "user") {
    return null
  }

  return messages
}

const MAX_CHAPTER_HTML_CHARS = 1_000_000

function readDecisions(value: unknown): { approved: boolean; id: string }[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  const decisions: { approved: boolean; id: string }[] = []
  for (const item of value) {
    if (!item || typeof item !== "object" || !("id" in item) || !("approved" in item)) {
      return null
    }
    if (typeof item.id !== "string" || typeof item.approved !== "boolean") {
      return null
    }
    decisions.push({ id: item.id, approved: item.approved })
  }
  return decisions
}

function readChapterHtml(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > MAX_CHAPTER_HTML_CHARS) {
    return
  }
  return value
}

function readFocus(value: unknown): ChatFocusKind | undefined {
  if (
    value === "chapter" ||
    value === "character" ||
    value === "location" ||
    value === "lore" ||
    value === "none" ||
    value === "note" ||
    value === "outline" ||
    value === "plot"
  ) {
    return value
  }
  return
}

function readChatContext(body: {
  chapterContent?: unknown
  chapterHtml?: unknown
  chapterId?: unknown
  focus?: unknown
  focusId?: unknown
}) {
  const focus = readFocus(body.focus)
  const onChapter = focus === undefined || focus === "chapter"
  return {
    focus,
    focusId: typeof body.focusId === "string" && body.focusId.length > 0 ? body.focusId : undefined,
    chapterId:
      onChapter && typeof body.chapterId === "string" && body.chapterId.length > 0
        ? body.chapterId
        : undefined,
    chapterContent:
      onChapter && typeof body.chapterContent === "string"
        ? body.chapterContent.slice(0, MAX_CLIENT_CHAPTER_CHARS)
        : undefined,
    chapterHtml: onChapter ? readChapterHtml(body.chapterHtml) : undefined,
  }
}

interface UpstreamResult {
  error?: string
  message?: string
  toolCalls?: ModelToolCall[]
  truncated?: boolean
}

async function readUpstreamError(response: Response): Promise<string> {
  try {
    const text = await response.text()
    return text.slice(0, UPSTREAM_ERROR_PREVIEW_CHARS)
  } catch {
    return "Unknown upstream error"
  }
}

function toOpenAiMessage(message: ProviderMessage) {
  if (message.role === "tool") {
    return {
      role: "tool",
      tool_call_id: message.toolCallId,
      content: message.content,
    }
  }
  if (message.toolCalls && message.toolCalls.length > 0) {
    return {
      role: "assistant",
      content: message.content.length > 0 ? message.content : null,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: "function",
        function: { name: call.name, arguments: call.arguments },
      })),
    }
  }
  return { role: message.role, content: message.content }
}

function readToolCalls(message: {
  tool_calls?: { function?: { arguments?: string; name?: string }; id?: string }[]
}): ModelToolCall[] {
  const calls: ModelToolCall[] = []
  for (const call of message.tool_calls ?? []) {
    if (call.id && call.function?.name) {
      calls.push({
        id: call.id,
        name: call.function.name,
        arguments: call.function.arguments ?? "{}",
      })
    }
  }
  return calls
}

async function callOpenAiCompatible(options: {
  url: string
  apiKey: string | null
  model: string
  system: string
  messages: ProviderMessage[]
  disableThinking?: boolean
  extraHeaders?: Record<string, string>
  maxTokens?: number
  tools?: ManuscriptTool[]
}): Promise<UpstreamResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.extraHeaders,
  }
  if (options.apiKey) {
    headers.Authorization = `Bearer ${options.apiKey}`
  }

  const response = await fetch(options.url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: options.model,
      max_tokens: boundedOutputTokens(options.url, options.maxTokens ?? MAX_OUTPUT_TOKENS),
      messages: [
        { role: "system", content: options.system },
        ...options.messages.map(toOpenAiMessage),
      ],
      ...(options.tools ? { tools: options.tools } : {}),
      ...(options.disableThinking ? deepseekCompletionExtras(options.url) : {}),
    }),
  })

  if (!response.ok) {
    const detail = await readUpstreamError(response)
    if (response.status === 402) {
      return {
        error: `${detail}\n\nThis model needs provider credits. Choose a different model in Dashboard → AI.`,
      }
    }
    return { error: detail }
  }

  const data = (await response.json()) as {
    choices?: {
      finish_reason?: string | null
      message?: {
        content?: string | null
        tool_calls?: { function?: { arguments?: string; name?: string }; id?: string }[]
      }
    }[]
  }
  const choice = data.choices?.at(0)
  const raw = choice?.message
  const toolCalls = raw ? readToolCalls(raw) : []
  const message = typeof raw?.content === "string" ? raw.content : ""

  if (message.length === 0 && toolCalls.length === 0) {
    return { error: "Provider returned an empty response" }
  }

  return { message, toolCalls, truncated: choice?.finish_reason === "length" }
}

function anthropicMessages(messages: ProviderMessage[]): ChatMessage[] {
  const converted: ChatMessage[] = []
  for (const message of messages) {
    if (message.role === "assistant" || message.role === "user") {
      converted.push({ role: message.role, content: message.content })
      continue
    }
    converted.push({ role: "user", content: `Tool result:\n${message.content}` })
  }
  return converted
}

async function callAnthropic(options: {
  apiKey: string
  model: string
  system: string
  messages: ProviderMessage[]
  maxTokens?: number
}): Promise<UpstreamResult> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": options.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: options.model,
      max_tokens: boundedOutputTokens(
        "https://api.anthropic.com/v1/messages",
        options.maxTokens ?? MAX_OUTPUT_TOKENS
      ),
      system: options.system,
      messages: anthropicMessages(options.messages),
    }),
  })

  if (!response.ok) {
    return { error: await readUpstreamError(response) }
  }

  const data = (await response.json()) as {
    content?: { type: string; text?: string }[]
    stop_reason?: string | null
  }
  const message = data.content
    ?.filter((block) => block.type === "text" && block.text)
    .map((block) => block.text)
    .join("")

  if (!message) {
    return { error: "Provider returned an empty response" }
  }

  return { message, truncated: data.stop_reason === "max_tokens" }
}

function parseProviderConfig(raw: string | null): Record<string, unknown> {
  if (!raw) {
    return {}
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

function readConfigString(config: Record<string, unknown>, key: string): string | undefined {
  const value = config[key]
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

// Model precedence: what the request asked for, then what the user saved on the
// provider, then the built-in default for that provider (if it has one).
function resolveModel(
  requested: string | undefined,
  config: Record<string, unknown>
): string | undefined {
  return requested?.trim() || readConfigString(config, "defaultModel")
}

function normalizeChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(TRAILING_SLASH_PATTERN, "")
  return trimmed.endsWith(CHAT_COMPLETIONS_SUFFIX)
    ? trimmed
    : `${trimmed}${CHAT_COMPLETIONS_SUFFIX}`
}

interface ProviderTarget {
  extraHeaders?: Record<string, string>
  model: string
  requiresApiKey: boolean
  url: string
}

// Resolve the endpoint and model for any OpenAI-compatible provider, including
// self-hosted (ollama) and arbitrary BYOK gateways (custom).
function resolveProviderTarget(options: {
  provider: string
  providerConfig: Record<string, unknown>
  model: string | undefined
}): ProviderTarget | { error: string } {
  const { provider, providerConfig } = options
  const model = resolveModel(options.model, providerConfig)

  if (provider === "ollama") {
    const baseUrl = readConfigString(providerConfig, "apiUrl") ?? OLLAMA_DEFAULT_URL
    return {
      url: `${baseUrl.replace(TRAILING_SLASH_PATTERN, "")}/v1/chat/completions`,
      model: model ?? OLLAMA_DEFAULT_MODEL,
      requiresApiKey: false,
    }
  }

  if (provider === "custom") {
    const baseUrl = readConfigString(providerConfig, "apiUrl")
    if (!baseUrl) {
      return { error: "This provider has no base URL configured. Set one in Dashboard → AI." }
    }
    if (!model) {
      return { error: "This provider has no model configured. Set one in Dashboard → AI." }
    }
    return { url: normalizeChatCompletionsUrl(baseUrl), model, requiresApiKey: false }
  }

  const endpoint = OPENAI_COMPATIBLE[provider as keyof typeof OPENAI_COMPATIBLE]
  if (!endpoint) {
    return { error: `Provider "${provider}" is not supported for chat yet` }
  }

  return {
    url: endpoint.url,
    model: model ?? endpoint.defaultModel,
    extraHeaders: provider === "openrouter" ? OPENROUTER_HEADERS : undefined,
    requiresApiKey: true,
  }
}

async function dispatchToProvider(options: {
  provider: string
  apiKey: string | null
  providerConfig: Record<string, unknown>
  model: string | undefined
  system: string
  messages: ProviderMessage[]
  disableThinking?: boolean
  maxTokens?: number
  tools?: ManuscriptTool[]
}): Promise<UpstreamResult & { model?: string }> {
  const { provider, apiKey, providerConfig, system, messages } = options

  if (provider === "anthropic") {
    if (!apiKey) {
      return { error: "Anthropic provider has no API key" }
    }
    const model = resolveModel(options.model, providerConfig) ?? ANTHROPIC_DEFAULT_MODEL
    return {
      ...(await callAnthropic({
        apiKey,
        model,
        system,
        messages,
        maxTokens: options.maxTokens,
      })),
      model,
    }
  }

  const target = resolveProviderTarget({ provider, providerConfig, model: options.model })
  if ("error" in target) {
    return { error: target.error }
  }
  if (target.requiresApiKey && !apiKey) {
    return { error: "Provider has no API key configured" }
  }

  return {
    ...(await callOpenAiCompatible({
      url: target.url,
      apiKey,
      model: target.model,
      system,
      messages,
      disableThinking: options.disableThinking,
      extraHeaders: target.extraHeaders,
      maxTokens: options.maxTokens,
      tools: options.tools,
    })),
    model: target.model,
  }
}

interface CompletionFailure {
  code?: "no_provider"
  error: string
  status: 412 | 500 | 502
}

interface CompletionSuccess {
  message: string
  model: string | null
  provider: string
  toolCalls: ModelToolCall[]
  truncated?: boolean
}

type CompletionResult = CompletionSuccess | CompletionFailure

function isCompletionFailure(result: CompletionResult): result is CompletionFailure {
  return "status" in result
}

// Resolve the user's provider, decrypt the key, dispatch, and track usage
async function runCompletionForUser(options: {
  userId: string
  env: Env
  system: string
  messages: ProviderMessage[]
  disableThinking?: boolean
  model?: string
  maxTokens?: number
  tools?: ManuscriptTool[]
}): Promise<CompletionResult> {
  const providers = await db
    .select({
      id: aiProvider.id,
      provider: aiProvider.provider,
      apiKey: aiProvider.apiKey,
      isDefault: aiProvider.isDefault,
      providerConfig: aiProvider.providerConfig,
      currentUsage: aiProvider.currentUsage,
    })
    .from(aiProvider)
    .where(and(eq(aiProvider.userId, options.userId), eq(aiProvider.isActive, true)))
    .orderBy(asc(aiProvider.createdAt))

  const selected = providers.find((p) => p.isDefault) ?? providers.at(0)

  if (!selected) {
    return {
      error: "No AI provider configured. Connect one in Dashboard → AI.",
      code: "no_provider",
      status: 412,
    }
  }

  let apiKey: string | null = null
  if (selected.apiKey) {
    try {
      apiKey = await decryptApiKey(selected.apiKey, options.env)
    } catch {
      return {
        error: "Failed to decrypt the stored API key. Try re-connecting the provider.",
        status: 500,
      }
    }
  }

  try {
    const result = await dispatchToProvider({
      provider: selected.provider,
      apiKey,
      providerConfig: parseProviderConfig(selected.providerConfig),
      model: options.model,
      system: options.system,
      messages: options.messages,
      disableThinking: options.disableThinking,
      maxTokens: options.maxTokens,
      tools: options.tools,
    })

    const toolCalls = result.toolCalls ?? []
    const text = result.message ?? ""
    if (result.error || (text.length === 0 && toolCalls.length === 0)) {
      return { error: result.error ?? "Provider returned no content", status: 502 }
    }

    await db
      .update(aiProvider)
      .set({ lastUsedAt: new Date(), currentUsage: (selected.currentUsage ?? 0) + 1 })
      .where(eq(aiProvider.id, selected.id))

    return {
      message: text,
      provider: selected.provider,
      model: result.model ?? null,
      toolCalls,
      truncated: result.truncated === true,
    }
  } catch {
    return { error: "Failed to reach the AI provider", status: 502 }
  }
}

const MAX_USER_MESSAGE_CHARS = 8000

function readUserText(body: { content?: unknown; messages?: unknown }): string | null {
  if (typeof body.content === "string" && body.content.trim().length > 0) {
    return body.content.trim().slice(0, MAX_USER_MESSAGE_CHARS)
  }
  const messages = validateMessages(body.messages)
  const last = messages?.at(-1)?.content.trim() ?? ""
  if (last.length === 0) {
    return null
  }
  return last.slice(0, MAX_USER_MESSAGE_CHARS)
}

const aiRouter = new Hono<{ Bindings: Env; Variables: Variables }>()

aiRouter.get("/chat", requireAuth, async (c: AppContext) => {
  const projectId = c.req.query("projectId")
  if (!projectId) {
    return c.json({ error: "projectId is required" }, 400)
  }
  const packet = await loadChatPacket({
    projectId,
    organizationId: c.get("activeOrganization")?.id ?? "",
  })
  if (!packet) {
    return c.json({ error: "Project not found" }, 404)
  }
  const pause = await readChatPause(projectId, c.get("user").id)
  return c.json({ messages: await listVisibleChat(projectId, c.get("user").id), ...pause })
})

aiRouter.post("/chat", requireAuth, async (c: AppContext) => {
  const user = c.get("user")
  const activeOrganization = c.get("activeOrganization")

  let body: {
    chapterContent?: unknown
    chapterHtml?: unknown
    chapterId?: unknown
    content?: unknown
    messages?: unknown
    allowCurrentChapter?: unknown
    focus?: unknown
    focusId?: unknown
    model?: unknown
    projectId?: unknown
  }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400)
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : ""
  const userText = readUserText(body)
  if (projectId.length === 0 || !userText) {
    return c.json({ error: "projectId and a user message are required" }, 400)
  }

  const context = readChatContext(body)
  const packet = await loadChatPacket({
    projectId,
    organizationId: activeOrganization?.id ?? "",
    ...context,
  })
  if (!packet) {
    return c.json({ error: "Project not found" }, 404)
  }

  const model = typeof body.model === "string" ? body.model : undefined
  const result = await replyInThread({
    packet,
    projectId,
    userId: user.id,
    userText,
    allowCurrentChapter: body.allowCurrentChapter === true,
    openChapterHtml: context.chapterHtml,
    openChapterId: context.chapterId,
    summarize: async (previous, folded) => {
      const summarized = await runCompletionForUser({
        userId: user.id,
        env: c.env,
        system: readPrompt("conversation-summary"),
        messages: [{ role: "user", content: summaryRequest(previous, folded) }],
        model,
        maxTokens: CONVERSATION_SUMMARY_MAX_TOKENS,
      })
      if (isCompletionFailure(summarized)) {
        return null
      }
      return summarized.message
    },
    complete: async (input) => {
      const turn = await runCompletionForUser({
        userId: user.id,
        env: c.env,
        system: input.system,
        messages: input.messages,
        tools: input.tools,
        model,
        maxTokens: input.maxTokens ?? CHAT_MAX_TOKENS,
        disableThinking: true,
      })
      if (isCompletionFailure(turn)) {
        return {
          error: turn.error,
          status: turn.status,
          code: turn.code,
          message: "",
          toolCalls: [],
        }
      }
      return {
        message: turn.message,
        toolCalls: turn.toolCalls,
        model: turn.model,
        provider: turn.provider,
        truncated: turn.truncated,
      }
    },
  })

  if ("error" in result) {
    return c.json(
      {
        error: result.error,
        edits: result.edits,
        ...(result.code ? { code: result.code } : {}),
      },
      result.status
    )
  }

  return c.json(result)
})

aiRouter.post("/chat/decide", requireAuth, async (c: AppContext) => {
  const user = c.get("user")
  const activeOrganization = c.get("activeOrganization")
  let body: {
    allowCurrentChapter?: unknown
    chapterHtml?: unknown
    chapterId?: unknown
    decisions?: unknown
    focus?: unknown
    focusId?: unknown
    model?: unknown
    projectId?: unknown
  }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400)
  }
  const projectId = typeof body.projectId === "string" ? body.projectId : ""
  const decisions = readDecisions(body.decisions)
  if (projectId.length === 0 || !decisions) {
    return c.json({ error: "projectId and decisions are required" }, 400)
  }
  const context = readChatContext(body)
  const packet = await loadChatPacket({
    projectId,
    organizationId: activeOrganization?.id ?? "",
    ...context,
  })
  if (!packet) {
    return c.json({ error: "Project not found" }, 404)
  }
  const model = typeof body.model === "string" ? body.model : undefined
  const result = await resumeInThread({
    allowCurrentChapter: body.allowCurrentChapter === true,
    decisions,
    openChapterHtml: context.chapterHtml,
    openChapterId: context.chapterId,
    packet,
    projectId,
    userId: user.id,
    complete: async (input) => {
      const turn = await runCompletionForUser({
        userId: user.id,
        env: c.env,
        system: input.system,
        messages: input.messages,
        tools: input.tools,
        model,
        maxTokens: input.maxTokens ?? CHAT_MAX_TOKENS,
        disableThinking: true,
      })
      if (isCompletionFailure(turn)) {
        return {
          error: turn.error,
          status: turn.status,
          code: turn.code,
          message: "",
          toolCalls: [],
        }
      }
      return {
        message: turn.message,
        toolCalls: turn.toolCalls,
        model: turn.model,
        provider: turn.provider,
        truncated: turn.truncated,
      }
    },
  })
  if ("error" in result) {
    return c.json(
      {
        error: result.error,
        edits: result.edits,
        ...(result.code ? { code: result.code } : {}),
      },
      result.status
    )
  }
  return c.json(result)
})

aiRouter.post("/chat/continue", requireAuth, async (c: AppContext) => {
  const user = c.get("user")
  const activeOrganization = c.get("activeOrganization")
  let body: {
    allowCurrentChapter?: unknown
    chapterHtml?: unknown
    chapterId?: unknown
    focus?: unknown
    focusId?: unknown
    model?: unknown
    projectId?: unknown
  }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400)
  }
  const projectId = typeof body.projectId === "string" ? body.projectId : ""
  if (projectId.length === 0) {
    return c.json({ error: "projectId is required" }, 400)
  }
  const context = readChatContext(body)
  const packet = await loadChatPacket({
    projectId,
    organizationId: activeOrganization?.id ?? "",
    ...context,
  })
  if (!packet) {
    return c.json({ error: "Project not found" }, 404)
  }
  const model = typeof body.model === "string" ? body.model : undefined
  const result = await resumeCutoffInThread({
    allowCurrentChapter: body.allowCurrentChapter === true,
    complete: async (input) => {
      const turn = await runCompletionForUser({
        userId: user.id,
        env: c.env,
        system: input.system,
        messages: input.messages,
        tools: input.tools,
        model,
        maxTokens: input.maxTokens ?? CHAT_MAX_TOKENS,
        disableThinking: true,
      })
      if (isCompletionFailure(turn)) {
        return {
          error: turn.error,
          status: turn.status,
          code: turn.code,
          message: "",
          toolCalls: [],
        }
      }
      return {
        message: turn.message,
        toolCalls: turn.toolCalls,
        model: turn.model,
        provider: turn.provider,
        truncated: turn.truncated,
      }
    },
    openChapterHtml: context.chapterHtml,
    openChapterId: context.chapterId,
    packet,
    projectId,
    userId: user.id,
  })
  if ("error" in result) {
    return c.json(
      {
        error: result.error,
        edits: result.edits,
        ...(result.code ? { code: result.code } : {}),
      },
      result.status
    )
  }
  return c.json(result)
})

aiRouter.post("/complete", requireAuth, async (c: AppContext) => {
  const user = c.get("user")
  let body: { model?: unknown; prefix?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400)
  }

  const prefix = readCompletionPrefix(body.prefix)
  if (prefix.length < MIN_COMPLETION_PREFIX) {
    return c.json({ text: "" })
  }

  const result = await runCompletionForUser({
    userId: user.id,
    env: c.env,
    system: readPrompt("completion"),
    messages: [{ role: "user", content: prefix }],
    disableThinking: true,
    model: typeof body.model === "string" ? body.model : undefined,
    maxTokens: AUTOCOMPLETE_MAX_TOKENS,
  })
  if (isCompletionFailure(result)) {
    if (result.code === "no_provider") {
      return c.json({ error: result.error, code: result.code }, result.status)
    }
    return c.json({ text: "" })
  }
  return c.json({ text: cleanContinuation(prefix, result.message) })
})

aiRouter.post("/import-extract", requireAuth, async (c: AppContext) => {
  const user = c.get("user")
  let body: { knownNames?: unknown; mode?: unknown; section?: unknown; text?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400)
  }

  const text = typeof body.text === "string" ? clipImportText(body.text) : ""
  if (text.length === 0) {
    return c.json({ ...emptyImportExtract(), parsed: true })
  }

  const mode = body.mode === "notes" || body.mode === "settings" ? body.mode : "manuscript"
  const known = Array.isArray(body.knownNames)
    ? clipKnownNames(body.knownNames.filter((name): name is string => typeof name === "string"))
    : []
  const section = typeof body.section === "string" ? body.section : undefined
  const result = await runCompletionForUser({
    userId: user.id,
    env: c.env,
    system: readPrompt("import-extract"),
    messages: [
      {
        role: "user",
        content: importExtractPrompt({ knownNames: known, mode, section, text }),
      },
    ],
    disableThinking: true,
    maxTokens: IMPORT_EXTRACT_MAX_TOKENS,
  })
  if (isCompletionFailure(result)) {
    return c.json(
      { error: result.error, ...(result.code ? { code: result.code } : {}) },
      result.status
    )
  }
  const extract = parseImportExtract(result.message)
  if (!extract) {
    return c.json({ ...emptyImportExtract(), parsed: false })
  }
  return c.json({ ...extract, parsed: true })
})

export type { ChatMessage, CompletionResult }
export { aiRouter, isCompletionFailure, resolveProviderTarget, runCompletionForUser }
