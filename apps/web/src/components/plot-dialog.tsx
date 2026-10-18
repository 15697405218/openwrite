import { useQuery } from "@tanstack/react-query"
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
import { api, type PlotThread } from "@/lib/api"

interface PlotDialogProps {
  mode: "create" | "edit"
  nextOrder: number
  onOpenChange: (open: boolean) => void
  onSubmit: (values: {
    characterIds: string[]
    chapterIds: string[]
    description: string
    order: number
    title: string
  }) => void
  open: boolean
  plot?: PlotThread | null
  projectId: string
  saving: boolean
}

export function PlotDialog({
  open,
  onOpenChange,
  projectId,
  plot,
  mode,
  nextOrder,
  saving,
  onSubmit,
}: PlotDialogProps) {
  const { messages: m } = useLocale()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [chapterIds, setChapterIds] = useState<string[]>([])
  const [characterIds, setCharacterIds] = useState<string[]>([])

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", projectId],
    queryFn: () => api.chapters.list(projectId),
    enabled: open,
  })
  const { data: characters = [] } = useQuery({
    queryKey: ["characters", projectId],
    queryFn: () => api.characters.list(projectId),
    enabled: open,
  })

  useEffect(() => {
    if (!open) {
      return
    }
    setTitle(plot?.title ?? "")
    setDescription(plot?.description ?? "")
    setChapterIds(plot?.chapterIds ?? [])
    setCharacterIds(plot?.characterIds ?? [])
  }, [open, plot])

  const trimmed = title.trim()

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? fill(m.codex.addNoun, { noun: m.codex.pages.plot.noun })
              : fill(m.codex.editNamed, { name: plot?.title ?? m.codex.pages.plot.noun })}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? fill(m.codex.entryAddHint, { noun: m.codex.pages.plot.noun })
              : fill(m.codex.entryUpdateHint, { noun: m.codex.pages.plot.noun })}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault()
            if (trimmed.length === 0 || saving) {
              return
            }
            onSubmit({
              title: trimmed,
              description: description.trim(),
              order: plot?.order ?? nextOrder,
              chapterIds,
              characterIds,
            })
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="plot-title">{m.codex.nameLabel}</Label>
            <Input
              id="plot-title"
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plot-description">{m.projects.description}</Label>
            <Textarea
              className="min-h-[100px]"
              id="plot-description"
              onChange={(event) => setDescription(event.target.value)}
              placeholder={m.codex.plotDescription}
              value={description}
            />
          </div>
          <BindingChecklist
            emptyLabel={m.codex.noChaptersToBind}
            group="plot-chapters"
            hint={m.codex.bindPlotChaptersHint}
            label={m.codex.bindPlotChapters}
            onChange={setChapterIds}
            options={chapters.map((chapter) => ({ id: chapter.id, label: chapter.title }))}
            searchPlaceholder={m.codex.searchBindings}
            selectedIds={chapterIds}
          />
          <BindingChecklist
            emptyLabel={m.codex.noCharactersToBind}
            group="plot-characters"
            hint={m.codex.bindPlotCharactersHint}
            label={m.codex.bindPlotCharacters}
            onChange={setCharacterIds}
            options={characters.map((character) => ({ id: character.id, label: character.name }))}
            searchPlaceholder={m.codex.searchBindings}
            selectedIds={characterIds}
          />
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
              {m.common.cancel}
            </Button>
            <Button disabled={trimmed.length === 0 || saving} type="submit">
              {saving ? m.common.saving : m.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
