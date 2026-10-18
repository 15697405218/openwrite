const TAG_PATTERN = /<[^>]+>/g
const BR_PATTERN = /<br\s*\/?>/gi
const BLOCK_END_PATTERN = /<\/(p|div|h[1-6]|li|blockquote)>/gi
const MULTI_NEWLINE_PATTERN = /\n{3,}/g

/** Turn stored editor HTML into plain text for prompts and summaries. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(BR_PATTERN, "\n")
    .replace(BLOCK_END_PATTERN, "\n")
    .replace(TAG_PATTERN, "")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replace(MULTI_NEWLINE_PATTERN, "\n\n")
    .trim()
}
