/**
 * Manuscript length for editor HTML.
 * Chinese, Japanese, and Korean characters each count as one.
 * A run of Latin letters or digits counts as one word.
 * Punctuation and whitespace are not counted.
 * The web app keeps an identical copy in apps/web/src/lib/word-count.ts.
 */

const HTML_TAG_PATTERN = /<[^>]*>/g
const HTML_ENTITY_PATTERN = /&[#a-zA-Z0-9]+;/g
const CJK_PATTERN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g
const WORD_PATTERN = /[A-Za-z0-9]+(?:['’-]?[A-Za-z0-9]+)*/g

export function countWords(text: string | null | undefined): number {
  if (!text) {
    return 0
  }
  const characters = text.match(CJK_PATTERN)?.length ?? 0
  const words = text.replace(CJK_PATTERN, " ").match(WORD_PATTERN)?.length ?? 0
  return characters + words
}

export function countWordsInHtml(html: string): number {
  const text = html.replace(HTML_TAG_PATTERN, " ").replace(HTML_ENTITY_PATTERN, " ")
  return countWords(text)
}
