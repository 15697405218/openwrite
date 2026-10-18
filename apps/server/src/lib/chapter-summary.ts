import { and, eq } from "drizzle-orm"
import { db } from "../db"
import { chapter, work } from "../db/schema"
import { type AiRuntimeEnv, isCompletionFailure, runCompletionForUser } from "../routers/ai"
import { CHAPTER_BODY_CHARS } from "./chat-context"
import { htmlToPlainText } from "./html-text"
import { CHAPTER_SUMMARY_MAX_TOKENS } from "./output-budget"

const SUMMARY_SOURCE_CHARS = CHAPTER_BODY_CHARS
const SUMMARY_MAX_CHARS = 2000

const SUMMARY_SYSTEM = `You write concise chapter summaries for fiction authors.
Summarize the chapter in the same language as the chapter.
Cover what happens, who is involved, and what changed.
Write 120 to 300 words, or the same amount in Chinese characters.
Plain prose only. No title, no bullet list, and no preamble.`

export interface SummaryEnv {
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  CORS_ORIGIN: string
  ENCRYPTION_KEY?: string
}

function asAiEnv(env: SummaryEnv): AiRuntimeEnv {
  return {
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
    CORS_ORIGIN: env.CORS_ORIGIN,
    ENCRYPTION_KEY: env.ENCRYPTION_KEY ?? "",
  }
}

export async function generateChapterSummary(options: {
  chapterId: string
  env: SummaryEnv
  projectId: string
  userId: string
}): Promise<
  { ok: true; summary: string } | { code?: string; error: string; ok: false; status: number }
> {
  const row = await db
    .select({
      id: chapter.id,
      title: chapter.title,
      content: chapter.content,
    })
    .from(chapter)
    .innerJoin(work, eq(chapter.workId, work.id))
    .where(and(eq(chapter.id, options.chapterId), eq(work.projectId, options.projectId)))
    .get()

  if (!row) {
    return { ok: false, error: "Chapter not found", status: 404 }
  }

  const plain = htmlToPlainText(row.content ?? "")
  if (plain.length === 0) {
    return {
      ok: false,
      error: "This chapter has no text to summarize",
      code: "empty_chapter",
      status: 400,
    }
  }

  const result = await runCompletionForUser({
    userId: options.userId,
    env: asAiEnv(options.env),
    system: SUMMARY_SYSTEM,
    maxTokens: CHAPTER_SUMMARY_MAX_TOKENS,
    messages: [
      {
        role: "user",
        content: `Chapter title: ${row.title}\n\n${plain.slice(0, SUMMARY_SOURCE_CHARS)}`,
      },
    ],
  })

  if (isCompletionFailure(result)) {
    return { ok: false, error: result.error, code: result.code, status: result.status }
  }

  const summary = result.message.trim().slice(0, SUMMARY_MAX_CHARS)
  if (summary.length === 0) {
    return { ok: false, error: "Provider returned an empty summary", status: 502 }
  }

  await db
    .update(chapter)
    .set({ summary, updatedAt: new Date() })
    .where(eq(chapter.id, options.chapterId))

  return { ok: true, summary }
}
