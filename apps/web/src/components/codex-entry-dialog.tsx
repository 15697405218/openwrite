import { useEffect, useState } from "react"
import { BindingChecklist } from "@/components/binding-checklist"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { fill, useLocale } from "@/i18n/locale"

export interface CodexEntryValues {
  chapterIds: string[]
  characterIds: string[]
  description: string
  name: string
}

interface CodexLinkChoices {
  chapterHint?: string
  chapters: { id: string; title: string }[]
  characters: { id: string; name: string }[]
  initialChapterIds: string[]
  initialCharacterIds: string[]
  showCharacters: boolean
}

function chapterBindingHint(
  links: CodexLinkChoices,
  messages: { codex: { bindChaptersHint: string; bindPlotChaptersHint: string } }
): string {
  if (links.chapterHint) {
    return links.chapterHint
  }
  if (links.showCharacters) {
    return messages.codex.bindPlotChaptersHint
  }
  return messages.codex.bindChaptersHint
}

interface CodexEntryDialogProps {
  initialDescription?: string
  initialName?: string
  isSaving: boolean
  links?: CodexLinkChoices
  mode: "create" | "edit"
  nameLabel: string
  nounLabel: string
  onOpenChange: (open: boolean) => void
  onSubmit: (values: CodexEntryValues) => void
  open: boolean
}

/**
 * Shared create/edit dialog for the codex entities (characters, locations,
 * lore, plot threads). They all reduce to a name/title plus a description, so a
 * single controlled form drives every type — the parent owns the mutation and
 * maps the values onto the right API client.
 */
export function CodexEntryDialog({
  open,
  onOpenChange,
  mode,
  nounLabel,
  nameLabel,
  initialName = "",
  initialDescription = "",
  links,
  isSaving,
  onSubmit,
}: CodexEntryDialogProps) {
  const { messages: m } = useLocale()
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [chapterIds, setChapterIds] = useState<string[]>(links?.initialChapterIds ?? [])
  const [characterIds, setCharacterIds] = useState<string[]>(links?.initialCharacterIds ?? [])

  const initialChapterKey = links?.initialChapterIds.join("\n") ?? ""
  const initialCharacterKey = links?.initialCharacterIds.join("\n") ?? ""

  // Reseed the fields whenever the dialog opens for a different entry.
  useEffect(() => {
    if (open) {
      setName(initialName)
      setDescription(initialDescription)
      setChapterIds(initialChapterKey.length > 0 ? initialChapterKey.split("\n") : [])
      setCharacterIds(initialCharacterKey.length > 0 ? initialCharacterKey.split("\n") : [])
    }
  }, [open, initialName, initialDescription, initialChapterKey, initialCharacterKey])

  const trimmedName = name.trim()
  const canSave = trimmedName.length > 0 && !isSaving

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSave) {
      return
    }
    onSubmit({
      name: trimmedName,
      description: description.trim(),
      chapterIds,
      characterIds,
    })
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? fill(m.codex.addNoun, { noun: nounLabel })
              : fill(m.codex.editNamed, { name: nounLabel })}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? fill(m.codex.entryAddHint, { noun: nounLabel })
              : fill(m.codex.entryUpdateHint, { noun: nounLabel })}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="codex-entry-name">{nameLabel} *</Label>
            <Input
              autoFocus
              id="codex-entry-name"
              onChange={(event) => setName(event.target.value)}
              placeholder={`${nameLabel}`}
              value={name}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="codex-entry-description">{m.projects.description}</Label>
            <Textarea
              className="min-h-[120px]"
              id="codex-entry-description"
              onChange={(event) => setDescription(event.target.value)}
              placeholder={fill(m.codex.describeEntry, { noun: nounLabel })}
              value={description}
            />
          </div>

          {links && (
            <BindingChecklist
              emptyLabel={m.codex.noChaptersToBind}
              group="codex-chapters"
              hint={chapterBindingHint(links, m)}
              label={links.showCharacters ? m.codex.bindPlotChapters : m.codex.bindChapters}
              onChange={setChapterIds}
              options={links.chapters.map((chapter) => ({ id: chapter.id, label: chapter.title }))}
              searchPlaceholder={m.codex.searchBindings}
              selectedIds={chapterIds}
            />
          )}

          {links?.showCharacters && (
            <BindingChecklist
              emptyLabel={m.codex.noCharactersToBind}
              group="codex-characters"
              hint={m.codex.bindPlotCharactersHint}
              label={m.codex.bindPlotCharacters}
              onChange={setCharacterIds}
              options={links.characters.map((character) => ({
                id: character.id,
                label: character.name,
              }))}
              searchPlaceholder={m.codex.searchBindings}
              selectedIds={characterIds}
            />
          )}

          <DialogFooter>
            <Button
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              {m.common.cancel}
            </Button>
            <Button disabled={!canSave} type="submit">
              {(() => {
                if (isSaving) {
                  return m.common.saving
                }
                return mode === "create"
                  ? fill(m.codex.addNoun, { noun: nounLabel })
                  : m.common.saveChanges
              })()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
