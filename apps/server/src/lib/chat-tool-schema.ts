export interface ManuscriptTool {
  function: {
    description: string
    name: string
    parameters: {
      additionalProperties: false
      properties: Record<string, { description: string; type: "string" }>
      required?: string[]
      type: "object"
    }
  }
  type: "function"
}

function tool(
  name: string,
  description: string,
  properties: Record<string, { description: string; type: "string" }>,
  required?: string[]
): ManuscriptTool {
  return {
    type: "function",
    function: {
      name,
      description,
      parameters: {
        type: "object",
        properties,
        additionalProperties: false,
        ...(required ? { required } : {}),
      },
    },
  }
}

const chapterId = {
  chapterId: {
    type: "string" as const,
    description: "Chapter id from list_chapters. Omit to read the chapter the writer has open.",
  },
}

export const manuscriptTools: ManuscriptTool[] = [
  tool(
    "list_chapters",
    "List this book's chapters in reading order. Does not return chapter text.",
    {}
  ),
  tool(
    "read_chapter",
    "Read one chapter's plain text and stored summary. Omit chapterId for the open chapter.",
    chapterId
  ),
  tool("list_characters", "List this book's characters by id and name.", {}),
  tool(
    "read_character",
    "Read one character's stored text and the chapters it is bound to.",
    {
      characterId: { type: "string", description: "Character id from list_characters." },
    },
    ["characterId"]
  ),
  tool("list_locations", "List this book's locations by id and name.", {}),
  tool(
    "read_location",
    "Read one location's stored text and the chapters it is bound to.",
    {
      locationId: { type: "string", description: "Location id from list_locations." },
    },
    ["locationId"]
  ),
  tool("list_plots", "List this book's plot threads by id and title.", {}),
  tool(
    "read_plot",
    "Read one plot thread's stored text.",
    {
      plotId: { type: "string", description: "Plot id from list_plots." },
    },
    ["plotId"]
  ),
  tool("list_lore", "List this book's worldbuilding entries by id and name.", {}),
  tool(
    "read_lore",
    "Read one worldbuilding entry's stored text.",
    {
      loreId: { type: "string", description: "Lore id from list_lore." },
    },
    ["loreId"]
  ),
  tool(
    "search_text",
    "Search chapter text for a short phrase and return excerpts. Use this before guessing a passage.",
    {
      query: { type: "string", description: "Plain-text phrase to find in chapter bodies." },
    },
    ["query"]
  ),
  tool(
    "append_to_chapter",
    "Append prose to the end of a chapter and save it. Use when the writer asks to continue or add a scene to the manuscript. Omit chapterId to edit the open chapter.",
    {
      chapterId: {
        type: "string",
        description: "Chapter id from list_chapters. Omit for the open chapter.",
      },
      text: {
        type: "string",
        description: "Prose to append. Plain text. Blank lines start new paragraphs.",
      },
    },
    ["text"]
  ),
  tool(
    "replace_in_chapter",
    "Replace one unique phrase in a chapter and save it. find must match the stored text exactly once.",
    {
      chapterId: {
        type: "string",
        description: "Chapter id from list_chapters. Omit for the open chapter.",
      },
      find: { type: "string", description: "Exact phrase to replace. Must occur once." },
      replace: { type: "string", description: "Replacement prose." },
    },
    ["find", "replace"]
  ),
]

export const CHAT_TOOL_GUIDE = `Manuscript text is not repeated on every turn.
A message that starts with CONTEXT UPDATE is attached only when the open chapter or its bound characters, places, plot threads, world entries, or selected summaries change. Until a newer CONTEXT UPDATE arrives, keep using the last one.
If a passage was summarized away or was never attached, call a tool. Do not invent manuscript text.
Read tools, limited to this book: list_chapters, read_chapter, list_characters, read_character, list_locations, read_location, list_plots, read_plot, list_lore, read_lore, search_text.
Write tools save the chapter after the writer confirms: append_to_chapter adds prose at the end; replace_in_chapter replaces one unique phrase. Use them when the writer asks you to put prose into the manuscript. Do not claim the prose is saved until the tool result says it was appended or replaced. If the result says the writer declined, leave the manuscript unchanged and offer another version.`
