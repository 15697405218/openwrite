import { isDeepSeekUrl } from "./completion-text"

// DeepSeek counts a thinking trace against max_tokens. High effort can spend
// thousands of tokens before any answer. This reserve is only added on calls
// that still allow thinking.
const THINKING_RESERVE = 16_384

// Other providers reject an output cap DeepSeek accepts. 8192 is the ceiling
// those chat models commonly allow.
const OTHER_PROVIDER_OUTPUT_CAP = 8192

// Autocomplete keeps thinking off. The editor shows at most 400 characters,
// and the model may write a little past that before the clip.
export const AUTOCOMPLETE_MAX_TOKENS = 2048

// Chat keeps thinking off. One write may carry 20_000 characters, counted at
// one token per character, plus the tool-call wrapper.
export const CHAT_MAX_TOKENS = 32_768

// Folded chat memory is at most 400 characters, with thinking left on.
export const CONVERSATION_SUMMARY_MAX_TOKENS = THINKING_RESERVE + 2048

// A chapter summary is stored up to 2_000 characters, with thinking left on.
export const CHAPTER_SUMMARY_MAX_TOKENS = THINKING_RESERVE + 4096

// A codex summary is stored up to 30_000 characters, with thinking left on.
export const CODEX_SUMMARY_MAX_TOKENS = THINKING_RESERVE + 32_768

// Story-map prose or a short JSON outline, with thinking left on.
export const CANVAS_MAX_TOKENS = THINKING_RESERVE + 8192

export function boundedOutputTokens(url: string, requested: number): number {
  if (isDeepSeekUrl(url)) {
    return requested
  }
  return Math.min(requested, OTHER_PROVIDER_OUTPUT_CAP)
}
