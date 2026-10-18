import { and, asc, eq, inArray, or } from "drizzle-orm"
import { db } from "../db"
import {
  chapter,
  chapterCharacter,
  chapterLocation,
  character,
  location,
  lore,
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
const PREVIOUS_CHAPTER_CHARS = CHAPTER_BODY_CHARS
const SUMMARY_CHARS = 1500

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
  previousChapterCount: number
  projectId: string
  summaryChapterIds: string[]
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
  const previousMeta = ordered.slice(Math.max(0, index - options.previousChapterCount), index)
  const contentIds = [options.chapterId, ...previousMeta.map((item) => item.id)]
  const contentRows = await db
    .select({ id: chapter.id, content: chapter.content })
    .from(chapter)
    .where(inArray(chapter.id, contentIds))
  const contentById = new Map(contentRows.map((row) => [row.id, row.content ?? ""]))

  const currentSource =
    options.chapterContent === undefined
      ? htmlToPlainText(contentById.get(options.chapterId) ?? "")
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

  const wantedSummaries = new Set(options.summaryChapterIds)
  const summaries: ChapterPiece[] = []
  for (const item of ordered) {
    const text = clip(item.summary?.trim() ?? "", SUMMARY_CHARS)
    if (wantedSummaries.has(item.id) && text.length > 0) {
      summaries.push({ id: item.id, title: item.title, text })
    }
  }

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
    previousChapters: previousMeta.map((item) => ({
      id: item.id,
      title: item.title,
      text: clip(htmlToPlainText(contentById.get(item.id) ?? ""), PREVIOUS_CHAPTER_CHARS),
    })),
    summaries,
  }
}

export async function loadChatPacket(options: {
  chapterContent?: string
  chapterId?: string
  organizationId: string
  previousChapterCount: number
  projectId: string | undefined
  summaryChapterIds: string[]
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

  const locations = options.chapterId
    ? await boundLocations(options.projectId, options.chapterId)
    : []
  const loreEntries = await namedForProject(lore, options.projectId)
  const chapters = options.chapterId
    ? await chapterPacket({
        projectId: options.projectId,
        chapterId: options.chapterId,
        previousChapterCount: options.previousChapterCount,
        summaryChapterIds: options.summaryChapterIds,
        chapterContent: options.chapterContent,
      })
    : {
        characters: [],
        currentChapter: null,
        plotThreads: [],
        previousChapters: [],
        summaries: [],
      }

  return {
    title: projectData.title,
    type: projectData.type,
    genre: projectData.genre,
    locations,
    lore: loreEntries,
    ...chapters,
  }
}

export async function buildProjectChatPrompt(options: {
  chapterContent?: string
  chapterId?: string
  organizationId: string
  previousChapterCount: number
  projectId: string | undefined
  summaryChapterIds: string[]
}): Promise<string> {
  const packet = await loadChatPacket(options)
  if (!packet) {
    return assembleChatPrompt(null)
  }
  return assembleChatPrompt(toPromptInput(packet))
}
