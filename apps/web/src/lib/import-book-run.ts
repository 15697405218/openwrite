import { aiApi } from "@/lib/api/ai"
import { ApiError } from "@/lib/api/base"
import { chaptersApi } from "@/lib/api/chapters"
import { charactersApi } from "@/lib/api/characters"
import { locationsApi } from "@/lib/api/locations"
import { loreApi } from "@/lib/api/lore"
import { outlineApi } from "@/lib/api/outline"
import { plotApi } from "@/lib/api/plot"
import { projectApi } from "@/lib/api/projects"
import { volumesApi } from "@/lib/api/volumes"
import {
  absorbExtract,
  type CatalogEntry,
  chunkText,
  emptyCatalog,
  type ImportCatalog,
  type ImportChapter,
  isChapterTitle,
  knownNames,
  type ParsedImport,
  parseImportFiles,
  textToHtml,
} from "@/lib/import-book"

const FILE_CHAR_LIMIT = 2_000_000

export interface ImportProgress {
  done: number
  phase: "entries" | "read" | "save"
  total: number
}

interface ReadJob {
  chapterKey: string | null
  locked: boolean
  mode: "manuscript" | "notes" | "settings"
  section?: string
  text: string
}

export async function runBookImport(options: {
  defaultVolumeTitle: string
  files: { name: string; text: string }[]
  onProgress: (progress: ImportProgress) => void
  outlineVolumeTitle: string
  title: string
}): Promise<{ missingProvider: boolean; projectId: string }> {
  const parsed = parseImportFiles(options.files)
  const project = await projectApi.create({
    description: null,
    title: options.title,
    type: "novel",
    visibility: "private",
  })
  const volumeIds = await createVolumes(project.id, parsed, options.defaultVolumeTitle)
  const chapterIds = await saveChapters(
    project.id,
    parsed.chapters,
    volumeIds,
    options.defaultVolumeTitle,
    options.onProgress
  )
  const jobs = readJobs(parsed)
  const catalog = emptyCatalog()
  const outlineTitles: string[] = []
  let missingProvider = false
  await eachSerial(jobs, async (job, index) => {
    if (missingProvider) {
      return
    }
    options.onProgress({ done: index, phase: "read", total: jobs.length })
    try {
      const extract = await aiApi.extractImport({
        knownNames: knownNames(catalog),
        mode: job.mode,
        section: job.section,
        text: job.text,
      })
      if (!extract.parsed) {
        return
      }
      absorbExtract(catalog, extract, { chapterKey: job.chapterKey, locked: job.locked })
      if (job.mode !== "manuscript") {
        outlineTitles.push(...extract.chapterTitles)
      }
    } catch (error) {
      missingProvider = isMissingProvider(error)
    }
  })
  options.onProgress({ done: jobs.length, phase: "read", total: jobs.length })
  await createOutlineChapters(
    project.id,
    parsed,
    outlineTitles,
    volumeIds,
    options.outlineVolumeTitle,
    chapterIds
  )
  await writeOutline(project.id, parsed)
  if (!missingProvider) {
    await writeCatalog(project.id, catalog, chapterIds, options.onProgress)
  }
  return { missingProvider, projectId: project.id }
}

export function readableImportFile(file: File): Promise<{ name: string; text: string } | null> {
  const lower = file.name.toLowerCase()
  if (!(lower.endsWith(".txt") || lower.endsWith(".md"))) {
    return Promise.resolve(null)
  }
  return file.text().then((text) => {
    if (text.length > FILE_CHAR_LIMIT) {
      return null
    }
    return { name: file.name, text }
  })
}

function collectVolumeTitles(parsed: ParsedImport, defaultVolumeTitle: string): string[] {
  const titles: string[] = []
  for (const chapter of parsed.chapters) {
    const title = chapter.volumeTitle ?? defaultVolumeTitle
    if (!titles.includes(title)) {
      titles.push(title)
    }
  }
  return titles
}

async function createVolumes(
  projectId: string,
  parsed: ParsedImport,
  defaultVolumeTitle: string
): Promise<Map<string, string>> {
  const titles = collectVolumeTitles(parsed, defaultVolumeTitle)
  if (titles.length === 0) {
    return new Map()
  }
  const ids = new Map<string, string>()
  await eachSerial(titles, async (title) => {
    const created = await volumesApi.create(projectId, title)
    ids.set(title, created.id)
  })
  return ids
}

async function saveChapters(
  projectId: string,
  chapters: ImportChapter[],
  volumeIds: Map<string, string>,
  defaultVolumeTitle: string,
  onProgress: (progress: ImportProgress) => void
): Promise<Map<string, string>> {
  const ids = new Map<string, string>()
  await eachSerial(chapters, async (chapter, index) => {
    onProgress({ done: index, phase: "save", total: chapters.length })
    const volumeTitle = chapter.volumeTitle ?? defaultVolumeTitle
    const volumeId = volumeIds.get(volumeTitle)
    const created = await chaptersApi.create(projectId, {
      skipSummary: true,
      title: chapter.title,
      volumeId,
    })
    ids.set(chapter.key, created.id)
    if (chapter.text.trim().length > 0) {
      await chaptersApi.saveContent(projectId, created.id, textToHtml(chapter.text))
    }
  })
  onProgress({ done: chapters.length, phase: "save", total: chapters.length })
  return ids
}

function readJobs(parsed: ParsedImport): ReadJob[] {
  const jobs: ReadJob[] = []
  for (const section of parsed.settings) {
    for (const text of chunkText(section.text)) {
      jobs.push({
        chapterKey: null,
        locked: true,
        mode: "settings",
        section: section.heading,
        text,
      })
    }
  }
  for (const note of parsed.notes) {
    for (const text of chunkText(note.text)) {
      jobs.push({ chapterKey: null, locked: false, mode: "notes", text })
    }
  }
  for (const chapter of parsed.chapters) {
    for (const text of chunkText(chapter.text)) {
      jobs.push({ chapterKey: chapter.key, locked: false, mode: "manuscript", text })
    }
  }
  return jobs
}

async function createOutlineChapters(
  projectId: string,
  parsed: ParsedImport,
  titles: string[],
  volumeIds: Map<string, string>,
  outlineVolumeTitle: string,
  chapterIds: Map<string, string>
): Promise<void> {
  const pending = uniqueChapterTitles(parsed, titles)
  if (pending.length === 0) {
    return
  }
  let volumeId = volumeIds.get(outlineVolumeTitle)
  if (!volumeId) {
    const created = await volumesApi.create(projectId, outlineVolumeTitle)
    volumeId = created.id
    volumeIds.set(outlineVolumeTitle, volumeId)
  }
  await eachSerial(pending, async (title, index) => {
    const created = await chaptersApi.create(projectId, {
      skipSummary: true,
      title,
      volumeId,
    })
    chapterIds.set(`outline${index + 1}`, created.id)
  })
}

async function writeOutline(projectId: string, parsed: ParsedImport): Promise<void> {
  const body = parsed.outlines
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .join("\n\n")
  if (body.length === 0) {
    return
  }
  await outlineApi.save(projectId, body)
}

function uniqueChapterTitles(parsed: ParsedImport, titles: string[]): string[] {
  const pending: string[] = []
  for (const title of titles) {
    const trimmed = title.trim()
    const duplicate = pending.some((item) => item.toLowerCase() === trimmed.toLowerCase())
    if (!isChapterTitle(trimmed) || duplicate) {
      continue
    }
    const exists = parsed.chapters.some(
      (chapter) => chapter.title.toLowerCase() === trimmed.toLowerCase()
    )
    if (!exists) {
      pending.push(trimmed)
    }
  }
  return pending
}

async function writeCatalog(
  projectId: string,
  catalog: ImportCatalog,
  chapterIds: Map<string, string>,
  onProgress: (progress: ImportProgress) => void
): Promise<void> {
  const total =
    catalog.characters.length + catalog.locations.length + catalog.lore.length + catalog.plot.length
  let done = 0
  const tick = () => {
    done += 1
    onProgress({ done, phase: "entries", total })
  }
  await writeNamed(catalog.characters, tick, async (entry) => {
    await charactersApi.create(projectId, {
      chapterIds: linkedChapters(entry, chapterIds),
      description: entry.description,
      name: entry.name,
    })
  })
  await writeNamed(catalog.locations, tick, async (entry) => {
    await locationsApi.create(projectId, {
      chapterIds: linkedChapters(entry, chapterIds),
      description: entry.description,
      name: entry.name,
    })
  })
  await writeNamed(catalog.lore, tick, async (entry) => {
    await loreApi.create(projectId, {
      description: entry.description,
      name: entry.name,
      type: "custom",
    })
  })
  await writeNamed(catalog.plot, tick, async (entry, index) => {
    await plotApi.create(projectId, {
      chapterIds: linkedChapters(entry, chapterIds),
      description: entry.description,
      order: index + 1,
      title: entry.name,
      type: "custom",
    })
  })
}

async function writeNamed(
  entries: CatalogEntry[],
  tick: () => void,
  create: (entry: CatalogEntry, index: number) => Promise<void>
): Promise<void> {
  await eachSerial(entries, async (entry, index) => {
    await create(entry, index)
    tick()
  })
}

function linkedChapters(entry: CatalogEntry, chapterIds: Map<string, string>): string[] {
  const ids: string[] = []
  for (const key of entry.chapterKeys) {
    const id = chapterIds.get(key)
    if (id) {
      ids.push(id)
    }
  }
  return ids
}

async function eachSerial<T>(
  items: T[],
  visit: (item: T, index: number) => Promise<void>
): Promise<void> {
  async function step(index: number): Promise<void> {
    const item = items.at(index)
    if (item === undefined) {
      return
    }
    await visit(item, index)
    await step(index + 1)
  }
  await step(0)
}

export function isMissingProvider(error: unknown): boolean {
  return error instanceof ApiError && error.code === "no_provider"
}
