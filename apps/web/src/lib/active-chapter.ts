export type PageFocusKind =
  | "chapter"
  | "character"
  | "location"
  | "lore"
  | "none"
  | "note"
  | "outline"
  | "plot"

export interface ActiveChapter {
  chapterId: string | null
  focusId: string | null
  focusKind: PageFocusKind
  projectId: string | null
}

const empty: ActiveChapter = {
  chapterId: null,
  focusId: null,
  focusKind: "none",
  projectId: null,
}

let page: ActiveChapter = empty
let overlay: ActiveChapter | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) {
    listener()
  }
}

function same(left: ActiveChapter, right: ActiveChapter): boolean {
  return (
    left.projectId === right.projectId &&
    left.chapterId === right.chapterId &&
    left.focusKind === right.focusKind &&
    left.focusId === right.focusId
  )
}

export function setActiveChapter(projectId: string, chapterId: string | null) {
  const next: ActiveChapter = {
    projectId,
    chapterId,
    focusKind: chapterId ? "chapter" : "none",
    focusId: chapterId,
  }
  if (same(page, next)) {
    return
  }
  page = next
  emit()
}

export function setPageFocus(projectId: string, focusKind: PageFocusKind, focusId: string | null) {
  const next: ActiveChapter = {
    projectId,
    chapterId: focusKind === "chapter" ? focusId : null,
    focusKind,
    focusId,
  }
  if (same(page, next)) {
    return
  }
  page = next
  emit()
}

export function clearPageFocus(projectId: string) {
  if (page.projectId !== projectId) {
    return
  }
  page = empty
  emit()
}

export function clearActiveChapter(projectId: string) {
  clearPageFocus(projectId)
}

export function setOverlayFocus(
  projectId: string,
  focusKind: PageFocusKind,
  focusId: string | null
) {
  const next: ActiveChapter = {
    projectId,
    chapterId: null,
    focusKind,
    focusId,
  }
  if (overlay && same(overlay, next)) {
    return
  }
  overlay = next
  emit()
}

export function clearOverlayFocus() {
  if (!overlay) {
    return
  }
  overlay = null
  emit()
}

export function subscribeActiveChapter(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getActiveChapterSnapshot(): ActiveChapter {
  return overlay ?? page
}
