interface ActiveChapter {
  chapterId: string | null
  projectId: string | null
}

let snapshot: ActiveChapter = { projectId: null, chapterId: null }
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) {
    listener()
  }
}

export function setActiveChapter(projectId: string, chapterId: string | null) {
  if (snapshot.projectId === projectId && snapshot.chapterId === chapterId) {
    return
  }
  snapshot = { projectId, chapterId }
  emit()
}

export function clearActiveChapter(projectId: string) {
  if (snapshot.projectId !== projectId) {
    return
  }
  snapshot = { projectId: null, chapterId: null }
  emit()
}

export function subscribeActiveChapter(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getActiveChapterSnapshot(): ActiveChapter {
  return snapshot
}
