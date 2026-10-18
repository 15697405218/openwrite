import { eq } from "drizzle-orm"
import { db } from "../db"
import { character, location, lore, plotPoint } from "../db/schema"
import { type AiRuntimeEnv, isCompletionFailure, runCompletionForUser } from "../routers/ai"
import type { SummaryEnv } from "./chapter-summary"
import { CODEX_SUMMARY_MAX_TOKENS } from "./output-budget"

export const CODEX_SUMMARY_THRESHOLD = 5000

const SUMMARY_STORE_CHARS = 30_000

const CODEX_SUMMARY_SYSTEM = `You condense a fiction reference entry so a writing assistant can use it later.
Keep every fact. Do not omit names, relationships, events, rules, places, motives, numbers, or constraints.
Shorten wording only. Use the same language as the source.
Plain prose. No title and no preamble.`

const KIND_LABEL = {
  character: "character",
  location: "location",
  lore: "worldbuilding entry",
  plot: "plot thread",
} as const

export type CodexKind = keyof typeof KIND_LABEL
export type CodexSummaryStatus = "cleared" | "created" | "failed" | "skipped"

function asAiEnv(env: SummaryEnv): AiRuntimeEnv {
  return {
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
    CORS_ORIGIN: env.CORS_ORIGIN,
    ENCRYPTION_KEY: env.ENCRYPTION_KEY ?? "",
  }
}

async function writeSummary(kind: CodexKind, id: string, summary: string | null) {
  const value = { summary, updatedAt: new Date() }
  if (kind === "character") {
    await db.update(character).set(value).where(eq(character.id, id))
    return
  }
  if (kind === "location") {
    await db.update(location).set(value).where(eq(location.id, id))
    return
  }
  if (kind === "lore") {
    await db.update(lore).set(value).where(eq(lore.id, id))
    return
  }
  await db.update(plotPoint).set(value).where(eq(plotPoint.id, id))
}

export async function syncCodexSummary(options: {
  description: unknown
  env: SummaryEnv
  id: string
  kind: CodexKind
  name: string
  userId: string
}): Promise<CodexSummaryStatus> {
  if (typeof options.description !== "string") {
    return "skipped"
  }

  const text = options.description.trim()
  if (text.length <= CODEX_SUMMARY_THRESHOLD) {
    await writeSummary(options.kind, options.id, null)
    return "cleared"
  }

  const result = await runCompletionForUser({
    userId: options.userId,
    env: asAiEnv(options.env),
    maxTokens: CODEX_SUMMARY_MAX_TOKENS,
    system: CODEX_SUMMARY_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Entry type: ${KIND_LABEL[options.kind]}\nName: ${options.name}\n\n${text}`,
      },
    ],
  })

  if (isCompletionFailure(result)) {
    await writeSummary(options.kind, options.id, null)
    return "failed"
  }

  const summary = result.message.trim().slice(0, SUMMARY_STORE_CHARS)
  if (summary.length === 0) {
    await writeSummary(options.kind, options.id, null)
    return "failed"
  }

  await writeSummary(options.kind, options.id, summary)
  return "created"
}
