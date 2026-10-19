import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { BindingChecklist } from "@/components/binding-checklist"
import { CharacterDialog } from "@/components/character-dialog"
import { LocationDialog } from "@/components/location-dialog"
import { PlotDialog } from "@/components/plot-dialog"
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
import { fill, useLocale } from "@/i18n/locale"
import { api } from "@/lib/api"
import { toastCodexSummary } from "@/lib/codex-summary"

interface ChapterCreateDialogProps {
  onCreated: (result: { id: string; previousSummary?: boolean }) => void
  onOpenChange: (open: boolean) => void
  open: boolean
  projectId: string
  volumeId?: string
  volumeTitle?: string
}

function createdId(result: unknown): string | undefined {
  if (!result || typeof result !== "object" || !("id" in result)) {
    return
  }
  return typeof result.id === "string" ? result.id : undefined
}

function remember(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids : [...ids, id]
}

export function ChapterCreateDialog({
  open,
  onOpenChange,
  projectId,
  volumeId,
  volumeTitle,
  onCreated,
}: ChapterCreateDialogProps) {
  const { messages: m } = useLocale()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState("")
  const [characterIds, setCharacterIds] = useState<string[]>([])
  const [locationIds, setLocationIds] = useState<string[]>([])
  const [plotIds, setPlotIds] = useState<string[]>([])
  const [characterOpen, setCharacterOpen] = useState(false)
  const [locationOpen, setLocationOpen] = useState(false)
  const [plotOpen, setPlotOpen] = useState(false)

  const { data: characters = [] } = useQuery({
    queryKey: ["characters", projectId],
    queryFn: () => api.characters.list(projectId),
    enabled: open,
  })
  const { data: locations = [] } = useQuery({
    queryKey: ["locations", projectId],
    queryFn: () => api.locations.list(projectId),
    enabled: open,
  })
  const { data: plots = [] } = useQuery({
    queryKey: ["plot", projectId],
    queryFn: () => api.plot.list(projectId),
    enabled: open,
  })

  useEffect(() => {
    if (!open) {
      return
    }
    setTitle("")
    setCharacterIds([])
    setLocationIds([])
    setPlotIds([])
  }, [open])

  const createChapter = useMutation({
    mutationFn: async () =>
      await api.chapters.create(projectId, {
        title: title.trim() || undefined,
        volumeId,
        volumeTitle,
        characterIds,
        locationIds,
        plotIds,
      }),
    onSuccess: (result) => {
      onOpenChange(false)
      onCreated(result)
    },
    onError: () => toast.error(m.chapters.createFailed),
  })

  const createPlot = useMutation({
    mutationFn: async (values: {
      characterIds: string[]
      chapterIds: string[]
      description: string
      order: number
      title: string
    }) => await api.plot.create(projectId, values),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["plot", projectId] })
      toast.success(m.codex.plotCreated)
      toastCodexSummary(result, m)
      const id = createdId(result)
      if (id) {
        setPlotIds((current) => remember(current, id))
      }
      setPlotOpen(false)
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : m.chapters.createFailed
      toast.error(fill(m.codex.plotSaveFailed, { message }))
    },
  })

  const newButton = (label: string, onClick: () => void) => (
    <Button className="h-7 px-2" onClick={onClick} size="sm" type="button" variant="outline">
      <Plus className="mr-1 h-3 w-3" />
      {label}
    </Button>
  )

  return (
    <>
      <Dialog
        onOpenChange={(next) => {
          if (!next && (characterOpen || locationOpen || plotOpen)) {
            return
          }
          onOpenChange(next)
        }}
        open={open}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{m.chapters.bindTitle}</DialogTitle>
            <DialogDescription>{m.chapters.bindHint}</DialogDescription>
          </DialogHeader>

          <form
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault()
              createChapter.mutate()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="new-chapter-title">{m.chapters.titleLabel}</Label>
              <Input
                id="new-chapter-title"
                onChange={(event) => setTitle(event.target.value)}
                placeholder={m.chapters.titlePlaceholder}
                value={title}
              />
            </div>

            <BindingChecklist
              action={newButton(m.chapters.newCharacter, () => setCharacterOpen(true))}
              emptyLabel={m.chapters.noCharacters}
              group="new-chapter-characters"
              hint=""
              label={m.codex.pages.characters.title}
              onChange={setCharacterIds}
              options={characters.map((character) => ({ id: character.id, label: character.name }))}
              searchPlaceholder={m.codex.searchBindings}
              selectedIds={characterIds}
            />

            <BindingChecklist
              action={newButton(m.chapters.newLocation, () => setLocationOpen(true))}
              emptyLabel={m.chapters.noLocations}
              group="new-chapter-locations"
              hint=""
              label={m.codex.pages.locations.title}
              onChange={setLocationIds}
              options={locations.map((location) => ({ id: location.id, label: location.name }))}
              searchPlaceholder={m.codex.searchBindings}
              selectedIds={locationIds}
            />

            <BindingChecklist
              action={newButton(m.chapters.newPlot, () => setPlotOpen(true))}
              emptyLabel={m.chapters.noPlots}
              group="new-chapter-plots"
              hint=""
              label={m.codex.pages.plot.title}
              onChange={setPlotIds}
              options={plots.map((plot) => ({ id: plot.id, label: plot.title ?? "" }))}
              searchPlaceholder={m.codex.searchBindings}
              selectedIds={plotIds}
            />

            <DialogFooter>
              <Button
                disabled={createChapter.isPending}
                onClick={() => onOpenChange(false)}
                type="button"
                variant="outline"
              >
                {m.common.cancel}
              </Button>
              <Button disabled={createChapter.isPending} type="submit">
                {createChapter.isPending ? m.chapters.creating : m.chapters.new}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CharacterDialog
        mode="create"
        onCreated={(id) => setCharacterIds((current) => remember(current, id))}
        onOpenChange={setCharacterOpen}
        open={characterOpen}
        projectId={projectId}
      />
      <LocationDialog
        mode="create"
        onCreated={(id) => setLocationIds((current) => remember(current, id))}
        onOpenChange={setLocationOpen}
        open={locationOpen}
        projectId={projectId}
      />
      <PlotDialog
        mode="create"
        nextOrder={plots.length + 1}
        onOpenChange={setPlotOpen}
        onSubmit={(values) => createPlot.mutate(values)}
        open={plotOpen}
        projectId={projectId}
        saving={createPlot.isPending}
      />
    </>
  )
}
