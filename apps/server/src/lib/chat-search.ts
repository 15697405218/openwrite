const EXCERPT_RADIUS = 80
const SEARCH_LIMIT = 8

export interface SearchChapter {
  id: string
  text: string
  title: string
}

export interface SearchHit {
  chapterId: string
  excerpt: string
  title: string
}

export function searchSnippets(chapters: SearchChapter[], query: string): SearchHit[] {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) {
    return []
  }
  const hits: SearchHit[] = []
  for (const chapter of chapters) {
    const haystack = chapter.text.toLowerCase()
    const at = haystack.indexOf(needle)
    if (at < 0) {
      continue
    }
    const start = Math.max(0, at - EXCERPT_RADIUS)
    const end = Math.min(chapter.text.length, at + needle.length + EXCERPT_RADIUS)
    hits.push({
      chapterId: chapter.id,
      title: chapter.title,
      excerpt: chapter.text.slice(start, end),
    })
    if (hits.length >= SEARCH_LIMIT) {
      break
    }
  }
  return hits
}
