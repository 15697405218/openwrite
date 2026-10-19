import { and, asc, eq, or } from "drizzle-orm"
import { db } from "../db"
import {
  chapter,
  chapterCharacter,
  chapterLocation,
  character,
  location,
  lore,
  note,
  outlineNode,
  plotPoint,
  volume,
  work,
} from "../db/schema"
import { codexPromptText } from "./chat-context"
import { searchSnippets } from "./chat-search"
import { type ChapterEdit, runWriteTool } from "./chat-write"
import { htmlToPlainText } from "./html-text"

const READ_CHARS = 100_000

function toolJson(value: unknown): string {
  return JSON.stringify(value)
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

function argString(args: Record<string, unknown>, key: string): string | null {
  const value = args[key]
  if (typeof value !== "string" || value.trim().length === 0) {
    return null
  }
  return value.trim()
}

async function listChapters(projectId: string) {
  const rows = await db
    .select({
      id: chapter.id,
      title: chapter.title,
      summary: chapter.summary,
    })
    .from(chapter)
    .innerJoin(work, eq(chapter.workId, work.id))
    .innerJoin(volume, eq(chapter.volumeId, volume.id))
    .where(eq(work.projectId, projectId))
    .orderBy(asc(volume.order), asc(chapter.order), asc(chapter.createdAt))
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    hasSummary: (row.summary?.trim() ?? "").length > 0,
  }))
}

async function readChapter(projectId: string, chapterId: string) {
  const row = await db
    .select({
      id: chapter.id,
      title: chapter.title,
      content: chapter.content,
      summary: chapter.summary,
    })
    .from(chapter)
    .innerJoin(work, eq(chapter.workId, work.id))
    .where(and(eq(chapter.id, chapterId), eq(work.projectId, projectId)))
    .get()
  if (!row) {
    return { error: "not_found" }
  }
  return {
    id: row.id,
    title: row.title,
    summary: row.summary?.trim() ?? "",
    text: htmlToPlainText(row.content ?? "").slice(0, READ_CHARS),
  }
}

async function listNamed(
  table: typeof character | typeof location | typeof lore,
  projectId: string
) {
  const rows = await db
    .select({ id: table.id, name: table.name })
    .from(table)
    .leftJoin(work, eq(table.workId, work.id))
    .where(or(eq(table.projectId, projectId), eq(work.projectId, projectId)))
    .orderBy(asc(table.name))
  return rows
}

async function readNamed(
  table: typeof character | typeof location | typeof lore,
  projectId: string,
  id: string
) {
  const row = await db
    .select({
      id: table.id,
      name: table.name,
      description: table.description,
      summary: table.summary,
    })
    .from(table)
    .leftJoin(work, eq(table.workId, work.id))
    .where(and(eq(table.id, id), or(eq(table.projectId, projectId), eq(work.projectId, projectId))))
    .get()
  if (!row) {
    return { error: "not_found" }
  }
  return {
    id: row.id,
    name: row.name,
    text: codexPromptText(row.summary, row.description).slice(0, READ_CHARS),
  }
}

async function characterChapters(characterId: string) {
  const rows = await db
    .select({ chapterId: chapterCharacter.chapterId })
    .from(chapterCharacter)
    .where(eq(chapterCharacter.characterId, characterId))
  return rows.map((row) => row.chapterId)
}

async function locationChapters(locationId: string) {
  const rows = await db
    .select({ chapterId: chapterLocation.chapterId })
    .from(chapterLocation)
    .where(eq(chapterLocation.locationId, locationId))
  return rows.map((row) => row.chapterId)
}

async function readOutline(projectId: string) {
  const row = await db
    .select({ id: outlineNode.id, body: outlineNode.body })
    .from(outlineNode)
    .where(eq(outlineNode.projectId, projectId))
    .get()
  if (!row) {
    return { id: null, text: "" }
  }
  return { id: row.id, text: (row.body ?? "").slice(0, READ_CHARS) }
}

async function listNotes(projectId: string) {
  return await db
    .select({ id: note.id, title: note.title })
    .from(note)
    .where(eq(note.projectId, projectId))
    .orderBy(asc(note.createdAt))
}

async function readNote(projectId: string, noteId: string) {
  const row = await db
    .select({ id: note.id, title: note.title, body: note.body })
    .from(note)
    .where(and(eq(note.id, noteId), eq(note.projectId, projectId)))
    .get()
  if (!row) {
    return { error: "not_found" }
  }
  return {
    id: row.id,
    title: row.title,
    text: (row.body ?? "").slice(0, READ_CHARS),
  }
}

async function searchNotes(projectId: string, query: string) {
  const rows = await db
    .select({ id: note.id, title: note.title, body: note.body })
    .from(note)
    .where(eq(note.projectId, projectId))
    .orderBy(asc(note.createdAt))
  return searchSnippets(
    rows.map((row) => ({
      id: row.id,
      title: row.title,
      text: `${row.title}\n${row.body ?? ""}`,
    })),
    query
  ).map((hit) => ({
    excerpt: hit.excerpt,
    noteId: hit.chapterId,
    title: hit.title,
  }))
}

async function searchChapters(projectId: string, query: string) {
  const rows = await db
    .select({ id: chapter.id, title: chapter.title, content: chapter.content })
    .from(chapter)
    .innerJoin(work, eq(chapter.workId, work.id))
    .innerJoin(volume, eq(chapter.volumeId, volume.id))
    .where(eq(work.projectId, projectId))
    .orderBy(asc(volume.order), asc(chapter.order))
  return searchSnippets(
    rows.map((row) => ({
      id: row.id,
      title: row.title,
      text: htmlToPlainText(row.content ?? ""),
    })),
    query
  )
}

async function readCharacter(projectId: string, characterId: string) {
  const entry = await readNamed(character, projectId, characterId)
  if ("error" in entry) {
    return entry
  }
  return { ...entry, chapterIds: await characterChapters(characterId) }
}

async function readLocation(projectId: string, locationId: string) {
  const entry = await readNamed(location, projectId, locationId)
  if ("error" in entry) {
    return entry
  }
  return { ...entry, chapterIds: await locationChapters(locationId) }
}

async function listPlots(projectId: string) {
  return await db
    .select({ id: plotPoint.id, title: plotPoint.title })
    .from(plotPoint)
    .where(eq(plotPoint.projectId, projectId))
    .orderBy(asc(plotPoint.order))
}

async function readPlot(projectId: string, plotId: string) {
  const row = await db
    .select({
      id: plotPoint.id,
      title: plotPoint.title,
      description: plotPoint.description,
      summary: plotPoint.summary,
    })
    .from(plotPoint)
    .where(and(eq(plotPoint.id, plotId), eq(plotPoint.projectId, projectId)))
    .get()
  if (!row) {
    return { error: "not_found" }
  }
  return {
    id: row.id,
    title: row.title,
    text: codexPromptText(row.summary, row.description).slice(0, READ_CHARS),
  }
}

function missing(key: string) {
  return { error: `missing ${key}` }
}

async function chapterTool(
  name: string,
  projectId: string,
  args: Record<string, unknown>,
  openChapterId: string | undefined
): Promise<unknown> {
  if (name === "list_chapters") {
    return await listChapters(projectId)
  }
  if (name === "read_chapter") {
    const chapterId = argString(args, "chapterId") ?? openChapterId
    if (!chapterId) {
      return missing("chapterId")
    }
    return await readChapter(projectId, chapterId)
  }
  if (name === "search_text") {
    const query = argString(args, "query")
    if (!query) {
      return missing("query")
    }
    return {
      chapters: await searchChapters(projectId, query),
      notes: await searchNotes(projectId, query),
    }
  }
  return null
}

async function codexTool(
  name: string,
  projectId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  if (name === "list_characters") {
    return await listNamed(character, projectId)
  }
  if (name === "read_character") {
    const characterId = argString(args, "characterId")
    if (!characterId) {
      return missing("characterId")
    }
    return await readCharacter(projectId, characterId)
  }
  if (name === "list_locations") {
    return await listNamed(location, projectId)
  }
  if (name === "read_location") {
    const locationId = argString(args, "locationId")
    if (!locationId) {
      return missing("locationId")
    }
    return await readLocation(projectId, locationId)
  }
  if (name === "list_plots") {
    return await listPlots(projectId)
  }
  if (name === "read_plot") {
    const plotId = argString(args, "plotId")
    if (!plotId) {
      return missing("plotId")
    }
    return await readPlot(projectId, plotId)
  }
  if (name === "list_lore") {
    return await listNamed(lore, projectId)
  }
  if (name === "read_lore") {
    const loreId = argString(args, "loreId")
    if (!loreId) {
      return missing("loreId")
    }
    return await readNamed(lore, projectId, loreId)
  }
  return null
}

async function noteTool(
  name: string,
  projectId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  if (name === "read_outline") {
    return await readOutline(projectId)
  }
  if (name === "list_notes") {
    return await listNotes(projectId)
  }
  if (name === "read_note") {
    const noteId = argString(args, "noteId")
    if (!noteId) {
      return missing("noteId")
    }
    return await readNote(projectId, noteId)
  }
  return null
}

export async function executeChatTool(options: {
  arguments: string
  edits?: ChapterEdit[]
  name: string
  openChapterHtml?: string
  openChapterId?: string
  projectId: string
  receiptId?: string
  threadId?: string
}): Promise<string> {
  const written = await runWriteTool({
    arguments: options.arguments,
    edits: options.edits ?? [],
    name: options.name,
    openChapterHtml: options.openChapterHtml,
    openChapterId: options.openChapterId,
    projectId: options.projectId,
    receiptId: options.receiptId,
    threadId: options.threadId,
  })
  if (written) {
    return written
  }
  const args = readArgs(options.arguments)
  const fromChapter = await chapterTool(
    options.name,
    options.projectId,
    args,
    options.openChapterId
  )
  if (fromChapter) {
    return toolJson(fromChapter)
  }
  const fromCodex = await codexTool(options.name, options.projectId, args)
  if (fromCodex) {
    return toolJson(fromCodex)
  }
  const fromNote = await noteTool(options.name, options.projectId, args)
  if (fromNote) {
    return toolJson(fromNote)
  }
  return toolJson({ error: "unknown_tool" })
}
