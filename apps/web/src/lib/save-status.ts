export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict"

export interface SaveStatusCopy {
  conflict: string
  failed: string
  lastSavedAt: (time: string) => string
  notSaved: string
  saved: string
  savedAt: (time: string) => string
  saving: string
  unsaved: string
}

const englishCopy: SaveStatusCopy = {
  unsaved: "Unsaved changes",
  saving: "Saving…",
  failed: "Save failed — retrying on next edit",
  conflict: "Edited elsewhere — reload to continue",
  saved: "Saved",
  savedAt: (time) => `Saved at ${time}`,
  lastSavedAt: (time) => `Last saved at ${time}`,
  notSaved: "Not saved yet",
}

function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function saveStatusText(
  state: SaveState,
  savedAt: string | null,
  copy: SaveStatusCopy = englishCopy
): string {
  switch (state) {
    case "dirty":
      return copy.unsaved
    case "saving":
      return copy.saving
    case "error":
      return copy.failed
    case "conflict":
      return copy.conflict
    case "saved":
      return savedAt ? copy.savedAt(formatTime(savedAt)) : copy.saved
    default:
      return savedAt ? copy.lastSavedAt(formatTime(savedAt)) : copy.notSaved
  }
}
