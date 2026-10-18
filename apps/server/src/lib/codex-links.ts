import { and, eq, inArray, or } from "drizzle-orm"
import { db } from "../db"
import {
  chapter,
  chapterCharacter,
  chapterLocation,
  character,
  location,
  plotPoint,
  plotPointChapter,
  plotPointCharacter,
  work,
} from "../db/schema"

export function readIdList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return
  }
  const ids: string[] = []
  for (const item of value) {
    if (typeof item === "string" && item.length > 0 && !ids.includes(item)) {
      ids.push(item)
    }
  }
  return ids
}

function group(rows: { key: string; value: string }[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const row of rows) {
    const list = map.get(row.key) ?? []
    list.push(row.value)
    map.set(row.key, list)
  }
  return map
}

export async function filterChapterIds(projectId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) {
    return []
  }
  const rows = await db
    .select({ id: chapter.id })
    .from(chapter)
    .innerJoin(work, eq(chapter.workId, work.id))
    .where(and(eq(work.projectId, projectId), inArray(chapter.id, ids)))
  const allowed = new Set(rows.map((row) => row.id))
  return ids.filter((id) => allowed.has(id))
}

export async function filterLocationIds(projectId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) {
    return []
  }
  const rows = await db
    .select({ id: location.id })
    .from(location)
    .leftJoin(work, eq(location.workId, work.id))
    .where(
      and(
        inArray(location.id, ids),
        or(eq(location.projectId, projectId), eq(work.projectId, projectId))
      )
    )
  const allowed = new Set(rows.map((row) => row.id))
  return ids.filter((id) => allowed.has(id))
}

export async function filterPlotIds(projectId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) {
    return []
  }
  const rows = await db
    .select({ id: plotPoint.id })
    .from(plotPoint)
    .leftJoin(work, eq(plotPoint.workId, work.id))
    .where(
      and(
        inArray(plotPoint.id, ids),
        or(eq(plotPoint.projectId, projectId), eq(work.projectId, projectId))
      )
    )
  const allowed = new Set(rows.map((row) => row.id))
  return ids.filter((id) => allowed.has(id))
}

export async function attachChapterBindings(
  projectId: string,
  chapterId: string,
  requested: { characterIds: string[]; locationIds: string[]; plotIds: string[] }
) {
  const characterIds = await filterCharacterIds(projectId, requested.characterIds)
  const locationIds = await filterLocationIds(projectId, requested.locationIds)
  const plotIds = await filterPlotIds(projectId, requested.plotIds)

  if (characterIds.length > 0) {
    await db.insert(chapterCharacter).values(
      characterIds.map((characterId) => ({
        chapterId,
        characterId,
      }))
    )
  }
  if (locationIds.length > 0) {
    await db.insert(chapterLocation).values(
      locationIds.map((locationId) => ({
        chapterId,
        locationId,
      }))
    )
  }
  if (plotIds.length > 0) {
    await db.insert(plotPointChapter).values(
      plotIds.map((plotPointId) => ({
        chapterId,
        plotPointId,
      }))
    )
  }
}

export async function filterCharacterIds(projectId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) {
    return []
  }
  const rows = await db
    .select({ id: character.id })
    .from(character)
    .where(and(eq(character.projectId, projectId), inArray(character.id, ids)))
  const allowed = new Set(rows.map((row) => row.id))
  return ids.filter((id) => allowed.has(id))
}

export async function characterChapterMap(projectId: string): Promise<Map<string, string[]>> {
  const rows = await db
    .select({
      key: chapterCharacter.characterId,
      value: chapterCharacter.chapterId,
    })
    .from(chapterCharacter)
    .innerJoin(character, eq(chapterCharacter.characterId, character.id))
    .where(eq(character.projectId, projectId))
  return group(rows)
}

export async function locationChapterMap(projectId: string): Promise<Map<string, string[]>> {
  const rows = await db
    .select({
      key: chapterLocation.locationId,
      value: chapterLocation.chapterId,
    })
    .from(chapterLocation)
    .innerJoin(location, eq(chapterLocation.locationId, location.id))
    .leftJoin(work, eq(location.workId, work.id))
    .where(or(eq(location.projectId, projectId), eq(work.projectId, projectId)))
  return group(rows)
}

export async function replaceLocationChapters(locationId: string, chapterIds: string[]) {
  await db.delete(chapterLocation).where(eq(chapterLocation.locationId, locationId))
  if (chapterIds.length === 0) {
    return
  }
  await db.insert(chapterLocation).values(
    chapterIds.map((chapterId) => ({
      chapterId,
      locationId,
    }))
  )
}

export async function replaceCharacterChapters(characterId: string, chapterIds: string[]) {
  await db.delete(chapterCharacter).where(eq(chapterCharacter.characterId, characterId))
  if (chapterIds.length === 0) {
    return
  }
  await db.insert(chapterCharacter).values(
    chapterIds.map((chapterId) => ({
      chapterId,
      characterId,
    }))
  )
}

export async function plotBindingMaps(projectId: string): Promise<{
  chapters: Map<string, string[]>
  characters: Map<string, string[]>
}> {
  const chapterRows = await db
    .select({
      key: plotPointChapter.plotPointId,
      value: plotPointChapter.chapterId,
    })
    .from(plotPointChapter)
    .innerJoin(plotPoint, eq(plotPointChapter.plotPointId, plotPoint.id))
    .where(eq(plotPoint.projectId, projectId))

  const characterRows = await db
    .select({
      key: plotPointCharacter.plotPointId,
      value: plotPointCharacter.characterId,
    })
    .from(plotPointCharacter)
    .innerJoin(plotPoint, eq(plotPointCharacter.plotPointId, plotPoint.id))
    .where(eq(plotPoint.projectId, projectId))

  return {
    chapters: group(chapterRows),
    characters: group(characterRows),
  }
}

export async function replacePlotChapters(plotPointId: string, chapterIds: string[]) {
  await db.delete(plotPointChapter).where(eq(plotPointChapter.plotPointId, plotPointId))
  if (chapterIds.length === 0) {
    return
  }
  await db.insert(plotPointChapter).values(
    chapterIds.map((chapterId) => ({
      plotPointId,
      chapterId,
    }))
  )
}

export async function replacePlotCharacters(plotPointId: string, characterIds: string[]) {
  await db.delete(plotPointCharacter).where(eq(plotPointCharacter.plotPointId, plotPointId))
  if (characterIds.length === 0) {
    return
  }
  await db.insert(plotPointCharacter).values(
    characterIds.map((characterId) => ({
      plotPointId,
      characterId,
    }))
  )
}

export function withLegacyChapter(chapterIds: string[], legacyChapterId: string | null): string[] {
  if (!legacyChapterId || chapterIds.includes(legacyChapterId)) {
    return chapterIds
  }
  return [legacyChapterId, ...chapterIds]
}
