// The import model returns names only. Chapter text is never taken from this JSON.

export const IMPORT_EXTRACT_MAX_TOKENS = 4096
const MAX_IMPORT_TEXT = 12_000
const MAX_KNOWN_NAMES = 400

export interface ImportExtract {
  chapterTitles: string[]
  characters: { description: string; name: string }[]
  locations: { description: string; name: string }[]
  lore: { description: string; name: string }[]
  mentions: { characters: string[]; locations: string[]; plot: string[] }
  plot: { description: string; title: string }[]
}

const FENCED_JSON = /^```(?:json)?\s*([\s\S]*?)```$/i

export function emptyImportExtract(): ImportExtract {
  return {
    chapterTitles: [],
    characters: [],
    locations: [],
    lore: [],
    mentions: { characters: [], locations: [], plot: [] },
    plot: [],
  }
}

export function clipImportText(text: string): string {
  return text.trim().slice(0, MAX_IMPORT_TEXT)
}

export function clipKnownNames(names: string[]): string[] {
  const clipped: string[] = []
  for (const name of names) {
    const trimmed = name.trim()
    if (trimmed.length === 0 || clipped.length >= MAX_KNOWN_NAMES) {
      continue
    }
    clipped.push(trimmed.slice(0, 80))
  }
  return clipped
}

export function importExtractPrompt(options: {
  knownNames: string[]
  mode: "manuscript" | "notes" | "settings"
  section?: string
  text: string
}): string {
  const section = options.section?.trim()
  const heading = section && section.length > 0 ? `\nSection: ${section}` : ""
  const known = clipKnownNames(options.knownNames).join(", ")
  return `Mode: ${options.mode}${heading}\nAlready saved: ${known}\n\nPassage:\n${clipImportText(options.text)}`
}

export function parseImportExtract(raw: string): ImportExtract | null {
  const unfenced = raw.trim().match(FENCED_JSON)?.[1]?.trim() ?? raw.trim()
  const start = unfenced.indexOf("{")
  const end = unfenced.lastIndexOf("}")
  if (start < 0 || end <= start) {
    return null
  }
  try {
    return readExtract(JSON.parse(unfenced.slice(start, end + 1)))
  } catch {
    return null
  }
}

function readExtract(value: unknown): ImportExtract | null {
  if (!isRecord(value)) {
    return null
  }
  const mentions = isRecord(value.mentions) ? value.mentions : {}
  return {
    chapterTitles: readStrings(value.chapterTitles),
    characters: readNamed(value.characters, "name"),
    locations: readNamed(value.locations, "name"),
    lore: readNamed(value.lore, "name"),
    mentions: {
      characters: readStrings(mentions.characters),
      locations: readStrings(mentions.locations),
      plot: readStrings(mentions.plot),
    },
    plot: readNamed(value.plot, "title").map((item) => ({
      description: item.description,
      title: item.name,
    })),
  }
}

function readNamed(value: unknown, key: "name" | "title"): { description: string; name: string }[] {
  if (!Array.isArray(value)) {
    return []
  }
  const items: { description: string; name: string }[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item[key] !== "string") {
      continue
    }
    const name = item[key].trim()
    if (name.length === 0) {
      continue
    }
    items.push({
      description: typeof item.description === "string" ? item.description.trim() : "",
      name,
    })
  }
  return items
}

function readStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  const names: string[] = []
  for (const item of value) {
    if (typeof item === "string" && item.trim().length > 0) {
      names.push(item.trim())
    }
  }
  return names
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
