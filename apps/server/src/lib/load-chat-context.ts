import { and, asc, eq, inArray, or } from "drizzle-orm"
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
  plotPointChapter,
  plotPointCharacter,
  project,
  volume,
  work,
} from "../db/schema"
import {
  assembleChatPrompt,
  CHAPTER_BODY_CHARS,
  type ChapterPiece,
  type ChatPacket,
  codexPromptText,
  relatedPlotIds,
  type TextPiece,
  toPromptInput,
} from "./chat-context"
import { htmlToPlainText } from "./html-text"

const CURRENT_CHAPTER_CHARS = CHAPTER_BODY_CHARS
const SUMMARY_CHARS = 1500
const OUTLINE_CHARS = 12_000

function clip(text: string, limit: number): string {
  return text.slice(0, limit)
}

async function namedForProject(table: typeof lore, projectId: string): Promise<TextPiece[]> {
  const rows = await db
    .select({
      id: table.id,
      name: table.name,
      description: table.description,
      summary: table.summary,
    })
    .from(table)
    .leftJoin(work, eq(table.workId, work.id))
    .where(or(eq(table.projectId, projectId), eq(work.projectId, projectId)))
    .orderBy(asc(table.name))

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    text: codexPromptText(row.summary, row.description),
  }))
}

async function boundLocations(projectId: string, chapterId: string): Promise<TextPiece[]> {
  const rows = await db
    .select({
      id: location.id,
      name: location.name,
      description: location.description,
      summary: location.summary,
    })
    .from(chapterLocation)
    .innerJoin(location, eq(chapterLocation.locationId, location.id))
    .leftJoin(work, eq(location.workId, work.id))
    .where(
      and(
        eq(chapterLocation.chapterId, chapterId),
        or(eq(location.projectId, projectId), eq(work.projectId, projectId))
      )
    )
    .orderBy(asc(location.name))

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    text: codexPromptText(row.summary, row.description),
  }))
}

async function chapterPacket(options: {
  chapterContent?: string
  chapterId: string
  projectId: string
}): Promise<{
  characters: TextPiece[]
  currentChapter: ChapterPiece | null
  plotThreads: TextPiece[]
  previousChapters: ChapterPiece[]
  summaries: ChapterPiece[]
}> {
  const ordered = await db
    .select({
      id: chapter.id,
      title: chapter.title,
      summary: chapter.summary,
    })
    .from(chapter)
    .innerJoin(work, eq(chapter.workId, work.id))
    .innerJoin(volume, eq(chapter.volumeId, volume.id))
    .where(eq(work.projectId, options.projectId))
    .orderBy(asc(volume.order), asc(chapter.order), asc(chapter.createdAt))

  const index = ordered.map((item) => item.id).indexOf(options.chapterId)
  if (index < 0) {
    return {
      characters: [],
      currentChapter: null,
      plotThreads: [],
      previousChapters: [],
      summaries: [],
    }
  }

  const current = ordered.at(index)
  const stored = await db
    .select({ content: chapter.content })
    .from(chapter)
    .where(eq(chapter.id, options.chapterId))
    .get()
  const currentSource =
    options.chapterContent === undefined
      ? htmlToPlainText(stored?.content ?? "")
      : options.chapterContent
  const currentText = clip(currentSource, CURRENT_CHAPTER_CHARS)

  const characterRows = await db
    .select({
      id: character.id,
      name: character.name,
      description: character.description,
      summary: character.summary,
    })
    .from(chapterCharacter)
    .innerJoin(character, eq(chapterCharacter.characterId, character.id))
    .where(eq(chapterCharacter.chapterId, options.chapterId))
    .orderBy(asc(character.name))

  const characterIds = characterRows.map((row) => row.id)
  const chapterLinks = await db
    .select({
      plotPointId: plotPointChapter.plotPointId,
      chapterId: plotPointChapter.chapterId,
    })
    .from(plotPointChapter)
    .where(eq(plotPointChapter.chapterId, options.chapterId))

  const legacyLinks = await db
    .select({
      plotPointId: plotPoint.id,
      chapterId: plotPoint.chapterId,
    })
    .from(plotPoint)
    .where(
      and(eq(plotPoint.projectId, options.projectId), eq(plotPoint.chapterId, options.chapterId))
    )

  const characterLinks =
    characterIds.length === 0
      ? []
      : await db
          .select({
            plotPointId: plotPointCharacter.plotPointId,
            characterId: plotPointCharacter.characterId,
          })
          .from(plotPointCharacter)
          .where(inArray(plotPointCharacter.characterId, characterIds))

  const plotIds = relatedPlotIds({
    chapterId: options.chapterId,
    characterIds,
    chapterLinks,
    characterLinks,
    legacyLinks,
  })

  const plotThreads =
    plotIds.length === 0
      ? []
      : await db
          .select({
            id: plotPoint.id,
            title: plotPoint.title,
            description: plotPoint.description,
            summary: plotPoint.summary,
          })
          .from(plotPoint)
          .where(and(eq(plotPoint.projectId, options.projectId), inArray(plotPoint.id, plotIds)))
          .orderBy(asc(plotPoint.order))

  const summaries = await boundSummaries(plotIds, ordered, options.chapterId)

  return {
    characters: characterRows.map((row) => ({
      id: row.id,
      name: row.name,
      text: codexPromptText(row.summary, row.description),
    })),
    currentChapter: current ? { id: current.id, title: current.title, text: currentText } : null,
    plotThreads: plotThreads.map((row) => ({
      id: row.id,
      name: row.title,
      text: codexPromptText(row.summary, row.description),
    })),
    previousChapters: [],
    summaries,
  }
}

async function boundSummaries(
  plotIds: string[],
  ordered: { id: string; summary: string | null; title: string }[],
  chapterId: string
): Promise<ChapterPiece[]> {
  if (plotIds.length === 0) {
    return []
  }
  const links = await db
    .select({ chapterId: plotPointChapter.chapterId })
    .from(plotPointChapter)
    .where(inArray(plotPointChapter.plotPointId, plotIds))
  const legacy = await db
    .select({ chapterId: plotPoint.chapterId })
    .from(plotPoint)
    .where(inArray(plotPoint.id, plotIds))
  const ids = new Set<string>()
  for (const link of links) {
    ids.add(link.chapterId)
  }
  for (const row of legacy) {
    if (row.chapterId) {
      ids.add(row.chapterId)
    }
  }
  ids.delete(chapterId)
  const summaries: ChapterPiece[] = []
  for (const item of ordered) {
    const text = clip(item.summary?.trim() ?? "", SUMMARY_CHARS)
    if (ids.has(item.id) && text.length > 0) {
      summaries.push({ id: item.id, title: item.title, text })
    }
  }
  return summaries
}

export type ChatFocusKind =
  | "chapter"
  | "character"
  | "location"
  | "lore"
  | "none"
  | "note"
  | "outline"
  | "plot"

function authorText(description: string | null, summary: string | null): string {
  const full = description?.trim() ?? ""
  if (full.length > 0) {
    return full
  }
  return summary?.trim() ?? ""
}

async function namedFocus(
  table: typeof character | typeof location | typeof lore,
  projectId: string,
  id: string
): Promise<TextPiece | null> {
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
    return null
  }
  return {
    id: row.id,
    name: row.name,
    text: clip(authorText(row.description, row.summary), CURRENT_CHAPTER_CHARS),
  }
}

async function focusPiece(
  projectId: string,
  kind: ChatFocusKind,
  id: string | undefined
): Promise<TextPiece | null> {
  if (!id) {
    return null
  }
  if (kind === "character") {
    return await namedFocus(character, projectId, id)
  }
  if (kind === "location") {
    return await namedFocus(location, projectId, id)
  }
  if (kind === "lore") {
    return await namedFocus(lore, projectId, id)
  }
  if (kind === "plot") {
    const row = await db
      .select({
        id: plotPoint.id,
        title: plotPoint.title,
        description: plotPoint.description,
        summary: plotPoint.summary,
      })
      .from(plotPoint)
      .where(and(eq(plotPoint.id, id), eq(plotPoint.projectId, projectId)))
      .get()
    if (!row) {
      return null
    }
    return {
      id: row.id,
      name: row.title,
      text: clip(authorText(row.description, row.summary), CURRENT_CHAPTER_CHARS),
    }
  }
  if (kind === "note") {
    const row = await db
      .select({ id: note.id, title: note.title, body: note.body })
      .from(note)
      .where(and(eq(note.id, id), eq(note.projectId, projectId)))
      .get()
    if (!row) {
      return null
    }
    return { id: row.id, name: row.title, text: clip(row.body ?? "", CURRENT_CHAPTER_CHARS) }
  }
  return null
}

function emptyStory(): Pick<
  ChatPacket,
  | "characters"
  | "currentChapter"
  | "focus"
  | "locations"
  | "lore"
  | "outline"
  | "plotThreads"
  | "previousChapters"
  | "summaries"
> {
  return {
    characters: [],
    currentChapter: null,
    focus: null,
    locations: [],
    lore: [],
    outline: null,
    plotThreads: [],
    previousChapters: [],
    summaries: [],
  }
}

export async function loadChatPacket(options: {
  chapterContent?: string
  chapterId?: string
  focus?: ChatFocusKind
  focusId?: string
  organizationId: string
  projectId: string | undefined
}): Promise<ChatPacket | null> {
  if (!options.projectId) {
    return null
  }

  const projectData = await db
    .select({
      title: project.title,
      type: project.type,
      genre: project.genre,
    })
    .from(project)
    .where(
      and(eq(project.id, options.projectId), eq(project.organizationId, options.organizationId))
    )
    .get()

  if (!projectData) {
    return null
  }

  const surface = options.focus ?? (options.chapterId ? "chapter" : "none")
  const base = {
    title: projectData.title,
    type: projectData.type,
    genre: projectData.genre,
  }
  if (surface === "chapter" && options.chapterId) {
    const locations = await boundLocations(options.projectId, options.chapterId)
    const loreEntries = await namedForProject(lore, options.projectId)
    const outline = await outlineForPrompt(options.projectId)
    const chapters = await chapterPacket({
      projectId: options.projectId,
      chapterId: options.chapterId,
      chapterContent: options.chapterContent,
    })
    return {
      ...base,
      locations,
      lore: loreEntries,
      outline,
      focus: null,
      ...chapters,
    }
  }
  if (surface === "outline") {
    return { ...base, ...emptyStory(), outline: await outlineForPrompt(options.projectId) }
  }
  if (
    surface === "character" ||
    surface === "location" ||
    surface === "lore" ||
    surface === "plot" ||
    surface === "note"
  ) {
    return {
      ...base,
      ...emptyStory(),
      focus: await focusPiece(options.projectId, surface, options.focusId),
    }
  }
  return { ...base, ...emptyStory() }
}

async function outlineForPrompt(projectId: string): Promise<TextPiece | null> {
  const row = await db
    .select({ id: outlineNode.id, body: outlineNode.body })
    .from(outlineNode)
    .where(eq(outlineNode.projectId, projectId))
    .get()
  const text = clip((row?.body ?? "").trim(), OUTLINE_CHARS)
  if (!(row && text.length > 0)) {
    return null
  }
  return { id: row.id, name: "Outline", text }
}

export async function buildProjectChatPrompt(options: {
  chapterContent?: string
  chapterId?: string
  focus?: ChatFocusKind
  focusId?: string
  organizationId: string
  projectId: string | undefined
}): Promise<string> {
  const packet = await loadChatPacket(options)
  if (!packet) {
    return assembleChatPrompt(null)
  }
  return assembleChatPrompt(toPromptInput(packet))
}
