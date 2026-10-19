import { readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import chapterSummary from "../prompts/chapter-summary.md"
import chatSystem from "../prompts/chat-system.md"
import chatTools from "../prompts/chat-tools.md"
import codexSummary from "../prompts/codex-summary.md"
import completion from "../prompts/completion.md"
import conversationSummary from "../prompts/conversation-summary.md"
import importExtract from "../prompts/import-extract.md"
import storyExpansion from "../prompts/story-expansion.md"
import storyGeneration from "../prompts/story-generation.md"

const BUNDLED = {
  "chapter-summary": chapterSummary,
  "chat-system": chatSystem,
  "chat-tools": chatTools,
  "codex-summary": codexSummary,
  completion,
  "conversation-summary": conversationSummary,
  "import-extract": importExtract,
  "story-expansion": storyExpansion,
  "story-generation": storyGeneration,
} as const

export type PromptName = keyof typeof BUNDLED

function normalizePrompt(text: string): string {
  return text.replaceAll("\r\n", "\n").trim()
}

interface FilePrompt {
  kind: "file"
  mtimeMs: number
  path: string
  size: number
  text: string
}

type CachedPrompt = { kind: "bundle"; text: string } | FilePrompt

const cache = new Map<PromptName, CachedPrompt>()

function bundledText(name: PromptName): string {
  return normalizePrompt(BUNDLED[name])
}

function readTrimmed(path: string): string | null {
  try {
    const text = normalizePrompt(readFileSync(path, "utf8"))
    if (text.length === 0) {
      return null
    }
    return text
  } catch {
    return null
  }
}

function candidatePaths(name: PromptName): string[] {
  return [
    join(process.cwd(), "src", "prompts", `${name}.md`),
    join(process.cwd(), "apps", "server", "src", "prompts", `${name}.md`),
    fileURLToPath(new URL(`../prompts/${name}.md`, import.meta.url)),
  ]
}

function locate(name: PromptName): string | null {
  for (const path of candidatePaths(name)) {
    try {
      statSync(path)
      return path
    } catch {
      // This location has no copy. Try the next one.
    }
  }
  return null
}

function rememberFile(name: PromptName, path: string): string | null {
  try {
    const stat = statSync(path)
    const text = readTrimmed(path)
    if (!text) {
      return null
    }
    cache.set(name, { kind: "file", mtimeMs: stat.mtimeMs, path, size: stat.size, text })
    return text
  } catch {
    return null
  }
}

function cachedText(name: PromptName): string | null {
  const hit = cache.get(name)
  if (!hit) {
    return null
  }
  if (hit.kind === "bundle") {
    return hit.text
  }
  try {
    const stat = statSync(hit.path)
    if (stat.mtimeMs === hit.mtimeMs && stat.size === hit.size) {
      return hit.text
    }
  } catch {
    cache.delete(name)
    return null
  }
  return rememberFile(name, hit.path)
}

function loadPrompt(name: PromptName): string {
  const path = locate(name)
  const live = path ? rememberFile(name, path) : null
  if (live) {
    return live
  }
  const text = bundledText(name)
  cache.set(name, { kind: "bundle", text })
  return text
}

// The text stays in memory. A local edit is picked up when the file time or size changes.
export function readPrompt(name: PromptName): string {
  return cachedText(name) ?? loadPrompt(name)
}
