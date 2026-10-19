const FENCE_START = /^```[a-zA-Z]*\n?/
const FENCE_END = /\n?```$/
const PARAGRAPH_BREAK = /\n{2,}/

const PREFIX_TAIL = 4000
const MAX_PREFIX_INPUT = 8000
const MAX_CONTINUATION = 400
const OVERLAP_TAIL = 80

export const MIN_COMPLETION_PREFIX = 8

const DEEPSEEK_HOST = "api.deepseek.com"

export function isDeepSeekUrl(url: string): boolean {
  try {
    return new URL(url).hostname === DEEPSEEK_HOST
  } catch {
    return false
  }
}

// deepseek-flash thinks unless this is set. A short autocomplete budget is then
// spent on reasoning_content, and content comes back empty.
export function deepseekCompletionExtras(url: string): { thinking?: { type: "disabled" } } {
  if (!isDeepSeekUrl(url)) {
    return {}
  }
  return { thinking: { type: "disabled" } }
}

export function readCompletionPrefix(value: unknown): string {
  if (typeof value !== "string") {
    return ""
  }
  const compact = value.slice(-MAX_PREFIX_INPUT).trim()
  if (compact.length <= PREFIX_TAIL) {
    return compact
  }
  return compact.slice(-PREFIX_TAIL)
}

function stripOverlap(prefix: string, text: string): string {
  const limit = Math.min(OVERLAP_TAIL, prefix.length, text.length)
  for (let size = limit; size >= MIN_COMPLETION_PREFIX; size -= 1) {
    if (text.startsWith(prefix.slice(-size))) {
      return text.slice(size).trim()
    }
  }
  return text
}

export function cleanContinuation(prefix: string, raw: string): string {
  let text = raw.trim()
  if (text.startsWith("```")) {
    text = text.replace(FENCE_START, "").replace(FENCE_END, "").trim()
  }
  if (prefix.length > 0 && text.startsWith(prefix)) {
    text = text.slice(prefix.length).trim()
  }
  text = stripOverlap(prefix, text)
  const paragraphs = text
    .split(PARAGRAPH_BREAK)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .slice(0, 2)
  text = paragraphs.join("\n\n")
  if (text.length <= MAX_CONTINUATION) {
    return text
  }
  return text.slice(0, MAX_CONTINUATION).trim()
}
