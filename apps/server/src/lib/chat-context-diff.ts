import type { ChapterPiece, ChatPacket, TextPiece } from "./chat-context"

export interface ContextMark {
  hash: string
  id: string
  name: string
}

export interface ContextFingerprint {
  characters: ContextMark[]
  current: ContextMark | null
  locations: ContextMark[]
  lore: ContextMark[]
  plots: ContextMark[]
  previous: ContextMark[]
  summaries: ContextMark[]
}

interface Listed {
  id: string
  name: string
  text: string
}

export function textHash(text: string): string {
  let hash = 0
  for (const char of text) {
    hash = Math.imul(hash, 33) + (char.codePointAt(0) ?? 0)
  }
  return String(hash)
}

function marks(items: Listed[]): ContextMark[] {
  return items.map((item) => ({ id: item.id, name: item.name, hash: textHash(item.text) }))
}

function chaptersAsListed(items: ChapterPiece[]): Listed[] {
  return items.map((item) => ({ id: item.id, name: item.title, text: item.text }))
}

export function fingerprintOf(packet: ChatPacket): ContextFingerprint {
  const current = packet.currentChapter
  return {
    characters: marks(packet.characters),
    current: current ? { id: current.id, name: current.title, hash: textHash(current.text) } : null,
    locations: marks(packet.locations),
    lore: marks(packet.lore),
    plots: marks(packet.plotThreads),
    previous: marks(chaptersAsListed(packet.previousChapters)),
    summaries: marks(chaptersAsListed(packet.summaries)),
  }
}

function isMark(value: unknown): value is ContextMark {
  if (!value || typeof value !== "object") {
    return false
  }
  const mark = value as { hash?: unknown; id?: unknown; name?: unknown }
  return (
    typeof mark.id === "string" && typeof mark.name === "string" && typeof mark.hash === "string"
  )
}

function markList(value: unknown): ContextMark[] | null {
  if (!(Array.isArray(value) && value.every(isMark))) {
    return null
  }
  return value
}

export function readFingerprint(raw: string | null): ContextFingerprint | null {
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as Partial<ContextFingerprint>
    const characters = markList(parsed.characters)
    const locations = markList(parsed.locations)
    const lore = markList(parsed.lore)
    const plots = markList(parsed.plots)
    const previous = markList(parsed.previous)
    const summaries = markList(parsed.summaries)
    const current = parsed.current === null ? null : parsed.current
    if (
      !(
        characters &&
        locations &&
        lore &&
        plots &&
        previous &&
        summaries &&
        (current === null || isMark(current))
      )
    ) {
      return null
    }
    return { characters, current, locations, lore, plots, previous, summaries }
  } catch {
    return null
  }
}

function pieceLine(item: Listed): string {
  const text = item.text.trim()
  if (text.length === 0) {
    return `- ${item.name}`
  }
  return `- ${item.name} — ${text}`
}

function chapterBlock(item: Listed): string {
  return `## ${item.name}\n${item.text}`
}

interface GroupDiff {
  added: Listed[]
  changed: Listed[]
  removed: ContextMark[]
  same: Listed[]
}

function classify(previous: ContextMark[], next: Listed[]): GroupDiff {
  const prevById = new Map(previous.map((item) => [item.id, item]))
  const nextIds = new Set(next.map((item) => item.id))
  const added: Listed[] = []
  const changed: Listed[] = []
  const same: Listed[] = []
  for (const item of next) {
    const prev = prevById.get(item.id)
    if (!prev) {
      added.push(item)
    } else if (prev.hash === textHash(item.text)) {
      same.push(item)
    } else {
      changed.push(item)
    }
  }
  return {
    added,
    changed,
    removed: previous.filter((item) => !nextIds.has(item.id)),
    same,
  }
}

function inventory(packet: ChatPacket): string {
  const chapter = packet.currentChapter?.title ?? "none"
  const names = (items: TextPiece[]) => items.map((item) => item.name).join(",") || "none"
  const titles = (items: ChapterPiece[]) => items.map((item) => item.title).join(",") || "none"
  return `Attached: chapter=${chapter}; characters=${names(packet.characters)}; locations=${names(packet.locations)}; plots=${names(packet.plotThreads)}; lore=${names(packet.lore)}; previous=${titles(packet.previousChapters)}; summaries=${titles(packet.summaries)}`
}

function pushPieces(lines: string[], heading: string, items: Listed[], asChapter: boolean) {
  if (items.length === 0) {
    return
  }
  lines.push("", heading)
  for (const item of items) {
    lines.push(asChapter ? chapterBlock(item) : pieceLine(item))
  }
}

function renderFull(packet: ChatPacket): string {
  const lines = ["CONTEXT UPDATE", inventory(packet)]
  const current = packet.currentChapter
    ? [
        {
          id: packet.currentChapter.id,
          name: packet.currentChapter.title,
          text: packet.currentChapter.text,
        },
      ]
    : []
  pushPieces(lines, "CURRENT CHAPTER:", current, true)
  pushPieces(lines, "PREVIOUS CHAPTERS:", chaptersAsListed(packet.previousChapters), true)
  pushPieces(lines, "CHARACTERS:", packet.characters, false)
  pushPieces(lines, "LOCATIONS:", packet.locations, false)
  pushPieces(lines, "WORLD:", packet.lore, false)
  pushPieces(lines, "PLOT THREADS:", packet.plotThreads, false)
  pushPieces(lines, "CHAPTER SUMMARIES:", chaptersAsListed(packet.summaries), true)
  return lines.join("\n")
}

function pushGroup(lines: string[], label: string, diff: GroupDiff, asChapter: boolean) {
  pushPieces(lines, `${label} (added):`, diff.added, asChapter)
  pushPieces(lines, `${label} (changed):`, diff.changed, asChapter)
  if (diff.removed.length > 0) {
    lines.push("", `${label} (removed): ${diff.removed.map((item) => item.name).join(", ")}`)
  }
}

function sameNames(groups: GroupDiff[]): string[] {
  const names: string[] = []
  for (const group of groups) {
    for (const item of group.same) {
      names.push(item.name)
    }
  }
  return names
}

function hasChange(groups: GroupDiff[]): boolean {
  return groups.some(
    (group) => group.added.length > 0 || group.changed.length > 0 || group.removed.length > 0
  )
}

function renderDelta(packet: ChatPacket, previous: ContextFingerprint): string | null {
  const current = packet.currentChapter
    ? [
        {
          id: packet.currentChapter.id,
          name: packet.currentChapter.title,
          text: packet.currentChapter.text,
        },
      ]
    : []
  const groups = [
    classify(previous.current ? [previous.current] : [], current),
    classify(previous.previous, chaptersAsListed(packet.previousChapters)),
    classify(previous.characters, packet.characters),
    classify(previous.locations, packet.locations),
    classify(previous.lore, packet.lore),
    classify(previous.plots, packet.plotThreads),
    classify(previous.summaries, chaptersAsListed(packet.summaries)),
  ]
  if (!hasChange(groups)) {
    return null
  }
  const lines = [
    "CONTEXT UPDATE",
    inventory(packet),
    "Only changes are included. Keep using the previous CONTEXT UPDATE for anything listed as unchanged.",
  ]
  const labels = [
    "CURRENT CHAPTER",
    "PREVIOUS CHAPTERS",
    "CHARACTERS",
    "LOCATIONS",
    "WORLD",
    "PLOT THREADS",
    "CHAPTER SUMMARIES",
  ]
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups.at(index)
    const label = labels.at(index)
    if (group && label) {
      pushGroup(lines, label, group, index < 2 || index === 6)
    }
  }
  const unchanged = sameNames(groups)
  if (unchanged.length > 0) {
    lines.push("", `UNCHANGED: ${unchanged.join("; ")}`)
  }
  return lines.join("\n")
}

export function contextUpdate(
  previous: ContextFingerprint | null,
  packet: ChatPacket
): { fingerprint: ContextFingerprint; text: string | null } {
  const fingerprint = fingerprintOf(packet)
  if (!previous) {
    return { fingerprint, text: renderFull(packet) }
  }
  return { fingerprint, text: renderDelta(packet, previous) }
}
