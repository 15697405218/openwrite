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
  tool("read_outline", "Read this book's outline.", {}),
  tool("list_notes", "List this book's notes by id and title. Does not return note text.", {}),
  tool(
    "read_note",
    "Read one note's stored text.",
    {
      noteId: { type: "string", description: "Note id from list_notes." },
    },
    ["noteId"]
  ),
  tool(
    "search_text",
    "Search chapter text and notes for a short phrase. Returns excerpts from both. Use this before guessing a passage.",
    {
      query: {
        type: "string",
        description: "Plain-text phrase to find in chapter bodies and notes.",
      },
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
    "append_to_outline",
    "Append text to the end of this book's outline and save it after the writer confirms.",
    {
      text: { type: "string", description: "Plain text to append to the outline." },
    },
    ["text"]
  ),
  tool(
    "replace_in_outline",
    "Replace one unique phrase in the book outline and save it after the writer confirms.",
    {
      find: { type: "string", description: "Exact phrase to replace. Must occur once." },
      replace: { type: "string", description: "Replacement text." },
    },
    ["find", "replace"]
  ),
  tool(
    "append_to_entry",
    "Append text to one character, location, lore entry, plot thread, or note, and save it after the writer confirms.",
    {
      kind: {
        type: "string",
        description: "One of character, location, lore, plot, note.",
      },
      id: { type: "string", description: "Id from the matching list tool." },
      text: { type: "string", description: "Plain text to append." },
    },
    ["kind", "id", "text"]
  ),
  tool(
    "replace_in_entry",
    "Replace one unique phrase in a character, location, lore entry, plot thread, or note, and save it after the writer confirms.",
    {
      kind: {
        type: "string",
        description: "One of character, location, lore, plot, note.",
      },
      id: { type: "string", description: "Id from the matching list tool." },
      find: { type: "string", description: "Exact phrase to replace. Must occur once." },
      replace: { type: "string", description: "Replacement text." },
    },
    ["kind", "id", "find", "replace"]
  ),
  tool(
    "create_entry",
    "Create a character, location, lore entry, plot thread, or note after the writer confirms.",
    {
      kind: {
        type: "string",
        description: "One of character, location, lore, plot, note.",
      },
      name: { type: "string", description: "Name or title of the new entry." },
      text: { type: "string", description: "Plain-text description. May be empty." },
    },
    ["kind", "name"]
  ),
  tool(
    "delete_entry",
    "Delete one character, location, lore entry, plot thread, or note after the writer confirms.",
    {
      kind: {
        type: "string",
        description: "One of character, location, lore, plot, note.",
      },
      id: { type: "string", description: "Id from the matching list tool." },
    },
    ["kind", "id"]
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
A message that starts with CONTEXT UPDATE follows the document open on screen.
On the chapter editor it includes that chapter, its outline, bound characters, places, plot threads, world entries, and summaries of other chapters on those plot threads.
On the outline page it includes only the outline. On a note, character, place, lore entry, or plot thread it includes only that entry. Elsewhere only the book title is attached.
Until a newer CONTEXT UPDATE arrives, keep using the last one. If something was not attached, call a tool. Do not invent text.
Read tools, limited to this book: list_chapters, read_chapter, list_characters, read_character, list_locations, read_location, list_plots, read_plot, list_lore, read_lore, read_outline, list_notes, read_note, search_text.
search_text looks through chapter bodies and notes.
Write tools save after the writer confirms. append_to_chapter and replace_in_chapter edit a chapter. append_to_outline and replace_in_outline edit the book outline. append_to_entry and replace_in_entry edit one character, location, lore entry, plot thread, or note. create_entry adds one and delete_entry removes one. kind is character, location, lore, plot, or note. id comes from the matching list tool. create_entry needs a name and may include text. Do not claim a save until the tool result says it was appended, replaced, created, or deleted. If the result says the writer declined, leave the book unchanged and offer another version.`
