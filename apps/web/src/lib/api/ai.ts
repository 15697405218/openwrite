/**
 * AI chat API client
 *
 * Sends chat messages to the server, which routes them to the
 * user's configured AI provider.
 */

import type { ChapterEdit } from "@/lib/chapter-edits"
import { apiCall } from "./base"

export interface AiChatMessage {
  content: string
  role: "user" | "assistant"
}

export interface StoredChatMessage {
  content: string
  createdAt: string
  id: string
  role: "assistant" | "user"
}

export interface WriteProposal {
  action: "append" | "replace"
  chapterId: string
  chapterTitle: string
  find: string
  id: string
  preview: string
}

export interface AiChatRequest {
  allowCurrentChapter?: boolean
  chapterContent?: string
  chapterHtml?: string
  chapterId?: string
  content: string
  model?: string
  previousChapterCount?: number
  projectId: string
  summaryChapterIds?: string[]
}

export interface AiChatResponse {
  edits: ChapterEdit[]
  message: string
  messages: StoredChatMessage[]
  model: string | null
  paused: boolean
  pending: WriteProposal[]
  preface: string
  provider: string
}

export interface AiDecideRequest {
  allowCurrentChapter?: boolean
  chapterHtml?: string
  chapterId?: string
  decisions: { approved: boolean; id: string }[]
  projectId: string
}

export interface AiCompleteRequest {
  model?: string
  prefix: string
  projectId?: string
  signal?: AbortSignal
}

export const aiApi = {
  async history(projectId: string): Promise<{
    continuation: boolean
    messages: StoredChatMessage[]
    pending: WriteProposal[]
    preface: string
  }> {
    return (await apiCall(`/api/ai/chat?projectId=${encodeURIComponent(projectId)}`)) as {
      continuation: boolean
      messages: StoredChatMessage[]
      pending: WriteProposal[]
      preface: string
    }
  },

  /**
   * Send the next user message. The server keeps the thread for this book.
   */
  async chat(data: AiChatRequest): Promise<AiChatResponse> {
    return (await apiCall("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify(data),
    })) as AiChatResponse
  },

  async continueCut(data: {
    allowCurrentChapter?: boolean
    chapterHtml?: string
    chapterId?: string
    projectId: string
  }): Promise<AiChatResponse> {
    return (await apiCall("/api/ai/chat/continue", {
      method: "POST",
      body: JSON.stringify(data),
    })) as AiChatResponse
  },

  async decide(data: AiDecideRequest): Promise<AiChatResponse> {
    return (await apiCall("/api/ai/chat/decide", {
      method: "POST",
      body: JSON.stringify(data),
    })) as AiChatResponse
  },

  async complete(data: AiCompleteRequest): Promise<{ text: string }> {
    const { signal, ...body } = data
    try {
      return (await apiCall("/api/ai/complete", {
        method: "POST",
        body: JSON.stringify(body),
        signal,
      })) as { text: string }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error
      }
      return { text: "" }
    }
  },
}
