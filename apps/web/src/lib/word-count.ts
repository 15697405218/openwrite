/**
 * Manuscript length for editor HTML. Mirrors apps/server/src/lib/word-count.ts
 * so the status bar matches the count stored on save.
 * Chinese, Japanese, and Korean characters each count as one.
 * A run of Latin letters or digits counts as one word.
 */

const HTML_TAG_PATTERN = /<[^>]*>/g
const HTML_ENTITY_PATTERN = /&[#a-zA-Z0-9]+;/g
const CJK_PATTERN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g
const WORD_PATTERN = /[A-Za-z0-9]+(?:['’-]?[A-Za-z0-9]+)*/g

export function countWordsInHtml(html: string): number {
  const text = html.replace(HTML_TAG_PATTERN, " ").replace(HTML_ENTITY_PATTERN, " ")
  const characters = text.match(CJK_PATTERN)?.length ?? 0
  const words = text.replace(CJK_PATTERN, " ").match(WORD_PATTERN)?.length ?? 0
  return characters + words
}
