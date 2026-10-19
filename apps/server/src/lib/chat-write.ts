import { and, eq } from "drizzle-orm"
import { db } from "../db"
import { chapter, chatToolReceipt, project, work } from "../db/schema"
import type { WriteProposal } from "./chat-approval"
import { describeEntryWrite, runEntryWrite } from "./chat-write-entry"
import { htmlToPlainText } from "./html-text"
import { secondResolutionNow } from "./optimistic-concurrency"
import { countWordsInHtml } from "./word-count"

const MAX_WRITE_CHARS = 20_000
const PREVIEW_CHARS = 2000
const PARAGRAPH_BREAK = /\n{2,}/

export interface ChapterEdit {
  chapterId: string
  content: string
  updatedAt: string
}

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

export function appendParagraphs(html: string, text: string): string {
  const blocks = text
    .split(PARAGRAPH_BREAK)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => `<p>${escapeHtml(block).replaceAll("\n", "<br>")}</p>`)
  if (blocks.length === 0) {
    return html
  }
  return `${html}${blocks.join("")}`
}

export function replaceOnce(
  html: string,
  find: string,
  replacement: string
): { html: string } | { error: string } {
  const needle = find.trim()
  if (needle.length === 0) {
    return { error: "find is empty" }
  }
  const plain = htmlToPlainText(html)
  const first = plain.indexOf(needle)
  if (first < 0) {
    return { error: "phrase not found" }
  }
  if (plain.indexOf(needle, first + needle.length) >= 0) {
    return { error: "phrase matches more than once" }
  }
  const inHtml = html.indexOf(needle)
  if (inHtml < 0 || html.indexOf(needle, inHtml + needle.length) >= 0) {
    return { error: "phrase crosses formatting; choose a shorter exact phrase" }
  }
  return {
    html: `${html.slice(0, inHtml)}${escapeHtml(replacement)}${html.slice(inHtml + needle.length)}`,
  }
}

function argString(args: Record<string, unknown>, key: string): string | null {
  const value = args[key]
  if (typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {}
    }
    return parsed as Record<string, unknown>
  } catch {
    return {}
  }
}

async function loadChapter(projectId: string, chapterId: string) {
  return await db
    .select({
      id: chapter.id,
      title: chapter.title,
      content: chapter.content,
      updatedAt: chapter.updatedAt,
    })
    .from(chapter)
    .innerJoin(work, eq(chapter.workId, work.id))
    .where(and(eq(chapter.id, chapterId), eq(work.projectId, projectId)))
    .get()
}

async function rememberedWrite(
  receiptId: string | undefined,
  projectId: string,
  chapterId: string,
  edits: ChapterEdit[]
): Promise<string | null> {
  if (!receiptId) {
    return null
  }
  const existing = await db
    .select()
    .from(chatToolReceipt)
    .where(eq(chatToolReceipt.id, receiptId))
    .get()
  if (!existing) {
    return null
  }
  const row = await loadChapter(projectId, chapterId)
  if (row?.content) {
    edits.push({
      chapterId,
      content: row.content,
      updatedAt: row.updatedAt.toISOString(),
    })
  }
  return existing.result
}

async function syncProjectWords(projectId: string, now: Date) {
  const rows = await db
    .select({ wordCount: chapter.wordCount })
    .from(chapter)
    .innerJoin(work, eq(chapter.workId, work.id))
    .where(eq(work.projectId, projectId))
  const total = rows.reduce((sum, row) => sum + (row.wordCount ?? 0), 0)
  await db
    .update(project)
    .set({ currentWordCount: total, updatedAt: now, lastWrittenAt: now })
    .where(eq(project.id, projectId))
}

async function saveChapter(
  projectId: string,
  chapterId: string,
  html: string,
  edits: ChapterEdit[],
  receipt: { id: string; result: string; threadId: string } | null
) {
  const now = secondResolutionNow()
  const patch = { content: html, wordCount: countWordsInHtml(html), updatedAt: now }
  if (receipt) {
    await db.batch([
      db.update(chapter).set(patch).where(eq(chapter.id, chapterId)),
      db.insert(chatToolReceipt).values({
        id: receipt.id,
        threadId: receipt.threadId,
        result: receipt.result,
      }),
    ])
  } else {
    await db.update(chapter).set(patch).where(eq(chapter.id, chapterId))
  }
  await syncProjectWords(projectId, now)
  edits.push({ chapterId, content: html, updatedAt: now.toISOString() })
}

export async function describeWrite(options: {
  arguments: string
  id: string
  name: string
  openChapterHtml?: string
  openChapterId?: string
  projectId: string
}): Promise<{ content: string } | { proposal: WriteProposal } | null> {
  const entry = await describeEntryWrite(options)
  if (entry) {
    return entry
  }
  if (options.name !== "append_to_chapter" && options.name !== "replace_in_chapter") {
    return null
  }
  const args = readArgs(options.arguments)
  const chapterId = argString(args, "chapterId") ?? options.openChapterId
  if (!chapterId) {
    return { content: JSON.stringify({ error: "missing chapterId" }) }
  }
  const row = await loadChapter(options.projectId, chapterId)
  if (!row) {
    return { content: JSON.stringify({ error: "not_found" }) }
  }
  if (options.name === "append_to_chapter") {
    const text = argString(args, "text")?.slice(0, MAX_WRITE_CHARS) ?? ""
    if (text.length === 0) {
      return { content: JSON.stringify({ error: "missing text" }) }
    }
    return {
      proposal: {
        action: "append",
        arguments: options.arguments,
        chapterId,
        chapterTitle: row.title,
        find: "",
        id: options.id,
        name: "append_to_chapter",
        preview: text.slice(0, PREVIEW_CHARS),
        target: "chapter",
      },
    }
  }
  const find = argString(args, "find") ?? ""
  if (find.length === 0) {
    return { content: JSON.stringify({ error: "find is empty" }) }
  }
  const replacement = (typeof args.replace === "string" ? args.replace : "").slice(
    0,
    MAX_WRITE_CHARS
  )
  const base =
    chapterId === options.openChapterId && options.openChapterHtml !== undefined
      ? options.openChapterHtml
      : (row.content ?? "")
  const replaced = replaceOnce(base, find, replacement)
  if ("error" in replaced) {
    return { content: JSON.stringify({ error: replaced.error }) }
  }
  return {
    proposal: {
      action: "replace",
      arguments: options.arguments,
      chapterId,
      chapterTitle: row.title,
      find: find.slice(0, PREVIEW_CHARS),
      id: options.id,
      name: "replace_in_chapter",
      preview: replacement.slice(0, PREVIEW_CHARS),
      target: "chapter",
    },
  }
}

export async function runWriteTool(options: {
  arguments: string
  edits: ChapterEdit[]
  name: string
  openChapterHtml?: string
  openChapterId?: string
  projectId: string
  receiptId?: string
  threadId?: string
}): Promise<string | null> {
  const entry = await runEntryWrite(options)
  if (entry) {
    return entry
  }
  if (options.name !== "append_to_chapter" && options.name !== "replace_in_chapter") {
    return null
  }
  const args = readArgs(options.arguments)
  const chapterId = argString(args, "chapterId") ?? options.openChapterId
  if (!chapterId) {
    return JSON.stringify({ error: "missing chapterId" })
  }
  const remembered = await rememberedWrite(
    options.receiptId,
    options.projectId,
    chapterId,
    options.edits
  )
  if (remembered) {
    return remembered
  }
  const row = await loadChapter(options.projectId, chapterId)
  if (!row) {
    return JSON.stringify({ error: "not_found" })
  }
  const base =
    chapterId === options.openChapterId && options.openChapterHtml !== undefined
      ? options.openChapterHtml
      : (row.content ?? "")

  if (options.name === "append_to_chapter") {
    const text = argString(args, "text")?.slice(0, MAX_WRITE_CHARS) ?? ""
    if (text.length === 0) {
      return JSON.stringify({ error: "missing text" })
    }
    const html = appendParagraphs(base, text)
    const result = JSON.stringify({ chapterId, title: row.title, appended: true })
    await saveChapter(
      options.projectId,
      chapterId,
      html,
      options.edits,
      writeReceipt(options, result)
    )
    return result
  }

  const find = argString(args, "find") ?? ""
  const replacement = (typeof args.replace === "string" ? args.replace : "").slice(
    0,
    MAX_WRITE_CHARS
  )
  const replaced = replaceOnce(base, find, replacement)
  if ("error" in replaced) {
    return JSON.stringify({ error: replaced.error })
  }
  const result = JSON.stringify({ chapterId, title: row.title, replaced: true })
  await saveChapter(
    options.projectId,
    chapterId,
    replaced.html,
    options.edits,
    writeReceipt(options, result)
  )
  return result
}

function writeReceipt(
  options: { receiptId?: string; threadId?: string },
  result: string
): { id: string; result: string; threadId: string } | null {
  if (!(options.receiptId && options.threadId)) {
    return null
  }
  return { id: options.receiptId, threadId: options.threadId, result }
}
