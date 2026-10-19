import { readPrompt } from "./prompt-files"

export const CHAPTER_BODY_CHARS = 100_000
const CURRENT_CHAPTER_CHARS = CHAPTER_BODY_CHARS
const PREVIOUS_CHAPTER_CHARS = CHAPTER_BODY_CHARS
const SUMMARY_CHARS = 1500

export interface NamedText {
  name: string
  text: string
}

export interface ChapterSnippet {
  text: string
  title: string
}

export interface TextPiece {
  id: string
  name: string
  text: string
}

export interface ChapterPiece {
  id: string
  text: string
  title: string
}

export interface ChatPacket {
  characters: TextPiece[]
  currentChapter: ChapterPiece | null
  focus: TextPiece | null
  genre: string | null
  locations: TextPiece[]
  lore: TextPiece[]
  outline: TextPiece | null
  plotThreads: TextPiece[]
  previousChapters: ChapterPiece[]
  summaries: ChapterPiece[]
  title: string
  type: string
}

export interface ChatPromptInput {
  characters: NamedText[]
  currentChapter: ChapterSnippet | null
  focus: ChapterSnippet | null
  genre: string | null
  locations: NamedText[]
  lore: NamedText[]
  outline: string | null
  plotThreads: NamedText[]
  previousChapters: ChapterSnippet[]
  summaries: ChapterSnippet[]
  title: string
  type: string
}

interface PlotLink {
  chapterId: string | null
  plotPointId: string
}

interface PlotCharacterLink {
  characterId: string
  plotPointId: string
}

export function relatedPlotIds(input: {
  chapterId: string
  chapterLinks: readonly PlotLink[]
  characterIds: readonly string[]
  characterLinks: readonly PlotCharacterLink[]
  legacyLinks: readonly PlotLink[]
}): string[] {
  const characters = new Set(input.characterIds)
  const ids = new Set<string>()

  for (const link of input.chapterLinks) {
    if (link.chapterId === input.chapterId) {
      ids.add(link.plotPointId)
    }
  }
  for (const link of input.legacyLinks) {
    if (link.chapterId === input.chapterId) {
      ids.add(link.plotPointId)
    }
  }
  for (const link of input.characterLinks) {
    if (characters.has(link.characterId)) {
      ids.add(link.plotPointId)
    }
  }

  return [...ids]
}

export function codexPromptText(
  summary: string | null | undefined,
  source: string | null | undefined
): string {
  const condensed = summary?.trim() ?? ""
  if (condensed.length > 0) {
    return condensed
  }
  return (source ?? "").trim()
}

function pushNamed(lines: string[], heading: string, items: NamedText[]) {
  if (items.length === 0) {
    return
  }
  lines.push("", `${heading}:`)
  for (const item of items) {
    const text = item.text.trim()
    const suffix = text.length > 0 ? ` — ${text}` : ""
    lines.push(`- ${item.name}${suffix}`)
  }
}

function pushBlock(lines: string[], heading: string, text: string | null) {
  const body = text?.trim() ?? ""
  if (body.length === 0) {
    return
  }
  lines.push("", `${heading}:`, body)
}

function pushChapters(lines: string[], heading: string, chapters: ChapterSnippet[], limit: number) {
  if (chapters.length === 0) {
    return
  }
  lines.push("", heading)
  for (const chapter of chapters) {
    lines.push(`## ${chapter.title}`, chapter.text.slice(0, limit))
  }
}

export function assembleChatPrompt(input: ChatPromptInput | null): string {
  const system = readPrompt("chat-system")
  if (!input) {
    return system
  }

  const lines = [system, "", "The writer is working on this project:"]
  lines.push(`- Title: ${input.title} (${input.type})`)
  if (input.genre) {
    lines.push(`- Genre: ${input.genre}`)
  }

  pushBlock(lines, "OUTLINE", input.outline)
  if (input.focus) {
    pushChapters(lines, "OPEN DOCUMENT:", [input.focus], CURRENT_CHAPTER_CHARS)
  }
  if (input.currentChapter) {
    pushChapters(lines, "CURRENT CHAPTER:", [input.currentChapter], CURRENT_CHAPTER_CHARS)
  }
  pushChapters(lines, "PREVIOUS CHAPTERS:", input.previousChapters, PREVIOUS_CHAPTER_CHARS)
  pushNamed(lines, "CHARACTERS IN THE CURRENT CHAPTER", input.characters)
  pushNamed(lines, "LOCATIONS", input.locations)
  pushNamed(lines, "WORLD", input.lore)
  pushNamed(lines, "PLOT THREADS FOR THE CURRENT CHAPTER", input.plotThreads)
  pushChapters(lines, "CHAPTER SUMMARIES TO INCLUDE:", input.summaries, SUMMARY_CHARS)

  return lines.join("\n")
}

export function toPromptInput(packet: ChatPacket): ChatPromptInput {
  return {
    characters: packet.characters.map((item) => ({ name: item.name, text: item.text })),
    currentChapter: packet.currentChapter
      ? { title: packet.currentChapter.title, text: packet.currentChapter.text }
      : null,
    focus: packet.focus ? { title: packet.focus.name, text: packet.focus.text } : null,
    genre: packet.genre,
    locations: packet.locations.map((item) => ({ name: item.name, text: item.text })),
    lore: packet.lore.map((item) => ({ name: item.name, text: item.text })),
    outline: packet.outline && packet.outline.text.trim().length > 0 ? packet.outline.text : null,
    plotThreads: packet.plotThreads.map((item) => ({ name: item.name, text: item.text })),
    previousChapters: packet.previousChapters.map((item) => ({
      title: item.title,
      text: item.text,
    })),
    summaries: packet.summaries.map((item) => ({ title: item.title, text: item.text })),
    title: packet.title,
    type: packet.type,
  }
}
