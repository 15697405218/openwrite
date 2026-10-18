export interface ChapterEdit {
  chapterId: string
  content: string
  updatedAt: string
}

type ChapterEditHandler = (edits: ChapterEdit[]) => void

let handler: ChapterEditHandler | null = null

export function setChapterEditHandler(next: ChapterEditHandler | null) {
  handler = next
}

export function applyChapterEdits(edits: ChapterEdit[]) {
  if (edits.length === 0) {
    return
  }
  handler?.(edits)
}
