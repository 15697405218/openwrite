// Split uploaded txt/md into manuscript chapters, labeled settings, outlines,
// and unlabeled notes. Chapter text and outline text are stored as written.
// The model only sees settings, notes, and manuscript chunks, and returns names.

export const IMPORT_CHUNK_CHARS = 8000
const DESCRIPTION_CHARS = 1500
const FILE_EXTENSION = /\.[^.]+$/
const PARAGRAPH_BREAK = /\n{2,}/
const MARKDOWN_HEADING = /^#{1,3}[ \t]+/

const CHAPTER_LINE =
  /^(?:#{1,3}[ \t]+)?(?:第[0-9０-９零〇一二三四五六七八九十百千两]+[章节回]|chapter[ \t]+\d+).*$/i
const VOLUME_LINE =
  /^(?:#{1,3}[ \t]+)?(?:第[0-9０-９零〇一二三四五六七八九十百千两]+卷|volume[ \t]+\d+).*$/i
const SETTINGS_LINE =
  /^(?:#{1,3}[ \t]+)?(?:人物|角色|地点|场景|世界观|设定|势力|characters?|locations?|settings?|world|lore|plot)[ \t]*[:：]?[ \t]*$/i
const HEADING_MARKS = /^(#+)/
const OUTLINE_HEADING =
  /^(?:总纲|大纲|卷纲|细纲|book outline|volume outline|chapter outline|detailed outline|outline)$/i

export interface ImportChapter {
  key: string
  text: string
  title: string
  volumeTitle: string | null
}

export interface ImportSection {
  heading: string
  text: string
  title: string
}

export interface ParsedImport {
  chapters: ImportChapter[]
  notes: ImportSection[]
  outlines: string[]
  settings: ImportSection[]
}

export interface CatalogEntry {
  chapterKeys: string[]
  description: string
  locked: boolean
  name: string
}

export interface ImportCatalog {
  characters: CatalogEntry[]
  locations: CatalogEntry[]
  lore: CatalogEntry[]
  plot: CatalogEntry[]
}

export interface ImportExtract {
  chapterTitles: string[]
  characters: { description: string; name: string }[]
  locations: { description: string; name: string }[]
  lore: { description: string; name: string }[]
  mentions: { characters: string[]; locations: string[]; plot: string[] }
  plot: { description: string; title: string }[]
}

type LineKind = "chapter" | "outline" | "settings" | "volume"

export function emptyCatalog(): ImportCatalog {
  return { characters: [], locations: [], lore: [], plot: [] }
}

export function fileTitle(name: string): string {
  const base = name.replace(FILE_EXTENSION, "").trim()
  return base.length > 0 ? base : name.trim()
}

export function isChapterTitle(title: string): boolean {
  return CHAPTER_LINE.test(title.trim())
}

export function textToHtml(text: string): string {
  const blocks = text
    .split(PARAGRAPH_BREAK)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
  if (blocks.length === 0) {
    return "<p></p>"
  }
  return blocks.map((block) => `<p>${escapeHtml(block).replaceAll("\n", "<br>")}</p>`).join("")
}

export function chunkText(text: string): string[] {
  const trimmed = text.trim()
  if (trimmed.length === 0) {
    return []
  }
  if (trimmed.length <= IMPORT_CHUNK_CHARS) {
    return [trimmed]
  }
  const chunks: string[] = []
  let start = 0
  while (start < trimmed.length) {
    let end = Math.min(start + IMPORT_CHUNK_CHARS, trimmed.length)
    if (end < trimmed.length) {
      const breakAt = trimmed.lastIndexOf("\n", end)
      if (breakAt > start + IMPORT_CHUNK_CHARS / 2) {
        end = breakAt
      }
    }
    const slice = trimmed.slice(start, end).trim()
    if (slice.length > 0) {
      chunks.push(slice)
    }
    if (end <= start) {
      break
    }
    start = end
  }
  return chunks
}

export function parseImportFiles(files: { name: string; text: string }[]): ParsedImport {
  const parsed: ParsedImport = { chapters: [], notes: [], outlines: [], settings: [] }
  for (const file of files) {
    const one = parseImportFile(file.name, file.text)
    parsed.chapters.push(...one.chapters)
    parsed.notes.push(...one.notes)
    parsed.outlines.push(...one.outlines)
    parsed.settings.push(...one.settings)
  }
  for (let index = 0; index < parsed.chapters.length; index += 1) {
    const chapter = parsed.chapters.at(index)
    if (chapter) {
      chapter.key = `c${index + 1}`
    }
  }
  return parsed
}

export function absorbExtract(
  catalog: ImportCatalog,
  extract: ImportExtract,
  options: { chapterKey: string | null; locked: boolean }
): void {
  for (const item of extract.characters) {
    addEntry(catalog.characters, item.name, item.description, options.locked, options.chapterKey)
  }
  for (const item of extract.locations) {
    addEntry(catalog.locations, item.name, item.description, options.locked, options.chapterKey)
  }
  for (const item of extract.lore) {
    addEntry(catalog.lore, item.name, item.description, options.locked, options.chapterKey)
  }
  for (const item of extract.plot) {
    addEntry(catalog.plot, item.title, item.description, options.locked, options.chapterKey)
  }
  for (const name of extract.mentions.characters) {
    addEntry(catalog.characters, name, "", false, options.chapterKey)
  }
  for (const name of extract.mentions.locations) {
    addEntry(catalog.locations, name, "", false, options.chapterKey)
  }
  for (const name of extract.mentions.plot) {
    addEntry(catalog.plot, name, "", false, options.chapterKey)
  }
}

export function knownNames(catalog: ImportCatalog): string[] {
  return [
    ...catalog.characters.map((item) => item.name),
    ...catalog.locations.map((item) => item.name),
    ...catalog.lore.map((item) => item.name),
    ...catalog.plot.map((item) => item.name),
  ]
}

function parseImportFile(name: string, raw: string): ParsedImport {
  const text = raw.replaceAll("\r\n", "\n").replaceAll("\r", "\n")
  const title = fileTitle(name)
  const lines = text.split("\n")
  if (!lines.some((line) => lineKind(line))) {
    const body = text.trim()
    return body.length === 0
      ? { chapters: [], notes: [], outlines: [], settings: [] }
      : { chapters: [], notes: [{ heading: "", text: body, title }], outlines: [], settings: [] }
  }

  const parsed: ParsedImport = { chapters: [], notes: [], outlines: [], settings: [] }
  let volumeTitle: string | null = null
  let kind: LineKind | "preamble" = "preamble"
  let heading = ""
  let buffer: string[] = []
  let chapterCount = 0
  let outlineDepth = 0

  const flush = () => {
    const body = buffer.join("\n").trim()
    buffer = []
    if (kind === "chapter") {
      chapterCount += 1
      parsed.chapters.push({
        key: `c${chapterCount}`,
        text: body,
        title: heading,
        volumeTitle,
      })
      return
    }
    if (kind === "outline") {
      if (body.length > 0) {
        parsed.outlines.push(body)
      }
      return
    }
    if (kind === "settings") {
      if (body.length > 0) {
        parsed.settings.push({ heading, text: body, title })
      }
      return
    }
    if (kind === "preamble" && body.length > 0) {
      parsed.notes.push({ heading: "", text: body, title })
    }
  }

  for (const line of lines) {
    const next = lineKind(line)
    if (kind === "outline" && next && staysInOutline(outlineDepth, line, next)) {
      buffer.push(line)
      continue
    }
    if (!next) {
      buffer.push(line)
      continue
    }
    flush()
    const label = headingText(line)
    if (next === "volume") {
      volumeTitle = label
      kind = "preamble"
      heading = ""
      continue
    }
    if (next === "outline") {
      outlineDepth = headingDepth(line)
    }
    kind = next
    heading = label
  }
  flush()
  return parsed
}

function lineKind(line: string): LineKind | null {
  const trimmed = line.trim()
  if (isOutlineHeading(headingText(trimmed))) {
    return "outline"
  }
  if (VOLUME_LINE.test(trimmed)) {
    return "volume"
  }
  if (SETTINGS_LINE.test(trimmed)) {
    return "settings"
  }
  if (CHAPTER_LINE.test(trimmed)) {
    return "chapter"
  }
  return null
}

function isOutlineHeading(heading: string): boolean {
  return OUTLINE_HEADING.test(heading.trim())
}

function headingDepth(line: string): number {
  return HEADING_MARKS.exec(line.trim())?.[1]?.length ?? 0
}

function staysInOutline(depth: number, line: string, next: LineKind): boolean {
  if (next === "settings" || next === "outline") {
    return false
  }
  if (next !== "volume" && next !== "chapter") {
    return false
  }
  return depth === 0 || headingDepth(line) > depth
}

function headingText(line: string): string {
  return line.trim().replace(MARKDOWN_HEADING, "")
}

function addEntry(
  list: CatalogEntry[],
  name: string,
  description: string,
  locked: boolean,
  chapterKey: string | null
): void {
  const trimmed = name.trim()
  if (trimmed.length === 0) {
    return
  }
  const found = list.find((item) => item.name.toLowerCase() === trimmed.toLowerCase())
  const clipped = description.trim().slice(0, DESCRIPTION_CHARS)
  if (!found) {
    list.push({
      chapterKeys: chapterKey ? [chapterKey] : [],
      description: clipped,
      locked,
      name: trimmed,
    })
    return
  }
  if (chapterKey && !found.chapterKeys.includes(chapterKey)) {
    found.chapterKeys.push(chapterKey)
  }
  if (found.locked || clipped.length === 0) {
    return
  }
  if (locked || found.description.length === 0) {
    found.description = clipped
    found.locked = locked || found.locked
  }
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}
