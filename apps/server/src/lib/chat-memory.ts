export const KEEP_RECENT_MESSAGES = 16

export interface StoredChatMessage {
  content: string
  id: string
  role: "assistant" | "context" | "user"
}

export function messagesAfter(
  messages: StoredChatMessage[],
  summarizedThroughId: string | null
): StoredChatMessage[] {
  if (!summarizedThroughId) {
    return messages
  }
  const index = messages.findIndex((message) => message.id === summarizedThroughId)
  if (index < 0) {
    return messages
  }
  return messages.slice(index + 1)
}

export function overflowSplit(messages: StoredChatMessage[]): {
  keep: StoredChatMessage[]
  overflow: StoredChatMessage[]
} | null {
  if (messages.length <= KEEP_RECENT_MESSAGES) {
    return null
  }
  return {
    overflow: messages.slice(0, messages.length - KEEP_RECENT_MESSAGES),
    keep: messages.slice(-KEEP_RECENT_MESSAGES),
  }
}

export function foldMessage(message: StoredChatMessage): string {
  if (message.role === "context") {
    const head = message.content.split("\n").slice(0, 2).join(" ")
    return `附带：${head}`.slice(0, 500)
  }
  const who = message.role === "user" ? "用户" : "助手"
  const text = message.content.trim()
  const clipped = text.length > 400 ? `${text.slice(0, 400)}…` : text
  return `${who}：${clipped}`
}

export function foldMessages(messages: StoredChatMessage[]): string {
  return messages.map((message) => foldMessage(message)).join("\n")
}

export function summaryRequest(previous: string, folded: string): string {
  const parts: string[] = []
  const prior = previous.trim()
  if (prior.length > 0) {
    parts.push(`已有摘要：\n${prior}`)
  }
  parts.push(`新增对话：\n${folded}`)
  return parts.join("\n\n")
}
