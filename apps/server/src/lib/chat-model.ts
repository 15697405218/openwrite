import type { ManuscriptTool } from "./chat-tool-schema"

export interface ModelToolCall {
  arguments: string
  id: string
  name: string
}

export interface ProviderMessage {
  content: string
  role: "assistant" | "tool" | "user"
  toolCallId?: string
  toolCalls?: ModelToolCall[]
}

export interface ModelTurn {
  code?: "no_provider"
  error?: string
  message: string
  model?: string | null
  provider?: string
  status?: 412 | 500 | 502
  toolCalls: ModelToolCall[]
  truncated?: boolean
}

export interface ModelRequest {
  maxTokens?: number
  messages: ProviderMessage[]
  system: string
  tools?: ManuscriptTool[]
}

export function turnFailed(turn: ModelTurn): boolean {
  return typeof turn.error === "string"
}
