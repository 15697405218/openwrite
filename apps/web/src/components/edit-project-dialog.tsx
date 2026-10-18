import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useLocale } from "@/i18n/locale"
import { api, type Project } from "@/lib/api"

interface EditProjectForm {
  description: string
  genre: string
  targetWordCount: string
  title: string
  type: "novel" | "trilogy" | "series" | "short_story_collection" | "graphic_novel" | "screenplay"
  visibility: "private" | "organization" | "public"
}

interface EditProjectDialogProps {
  onOpenChange: (open: boolean) => void
  open: boolean
  project: Project
}

export function EditProjectDialog({ project, open, onOpenChange }: EditProjectDialogProps) {
  const { messages: m } = useLocale()
  const queryClient = useQueryClient()
  const [editForm, setEditForm] = useState<EditProjectForm>({
    title: project.title,
    description: project.description || "",
    type: project.type,
    genre: project.genre || "",
    targetWordCount: project.targetWordCount?.toString() || "",
    visibility: project.visibility,
  })

  // Update project mutation
  const updateProjectMutation = useMutation({
    mutationFn: async (data: EditProjectForm) => {
      if (!api.projects.update) {
        throw new Error("Update method not available")
      }
      const result = await api.projects.update(project.id, {
        title: data.title,
        description: data.description || null,
        type: data.type,
        genre: data.genre || null,
        targetWordCount: data.targetWordCount ? Number.parseInt(data.targetWordCount, 10) : null,
        visibility: data.visibility,
      })
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
      onOpenChange(false)
      toast.success(m.projects.updated, {
        description: m.projects.changesSaved,
      })
    },
    onError: (error) => {
      toast.error(m.projects.updateFailed, {
        description: error instanceof Error ? error.message : m.projects.tryAgain,
      })
    },
  })

  const handleUpdateProject = () => {
    if (!editForm.title.trim()) {
      toast.error(m.projects.titleRequired)
      return
    }
    updateProjectMutation.mutate(editForm)
  }

  const handleCancel = () => {
    // Reset form to original values
    setEditForm({
      title: project.title,
      description: project.description || "",
      type: project.type,
      genre: project.genre || "",
      targetWordCount: project.targetWordCount?.toString() || "",
      visibility: project.visibility,
    })
    onOpenChange(false)
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{m.projects.editTitle}</DialogTitle>
          <DialogDescription>{m.projects.editHint}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">{m.projects.titleLabel}</Label>
            <Input
              id="edit-title"
              onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder={m.projects.titlePlaceholder}
              value={editForm.title}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">{m.projects.description}</Label>
            <Textarea
              id="edit-description"
              onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder={m.projects.descriptionPlaceholder}
              value={editForm.description}
            />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-type">{m.projects.type}</Label>
              <Select
                onValueChange={(
                  value:
                    | "novel"
                    | "trilogy"
                    | "series"
                    | "short_story_collection"
                    | "graphic_novel"
                    | "screenplay"
                ) => setEditForm((prev) => ({ ...prev, type: value }))}
                value={editForm.type}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="novel">{m.projects.types.novel}</SelectItem>
                  <SelectItem value="trilogy">{m.projects.types.trilogy}</SelectItem>
                  <SelectItem value="series">{m.projects.types.series}</SelectItem>
                  <SelectItem value="short_story_collection">
                    {m.projects.types.short_story_collection}
                  </SelectItem>
                  <SelectItem value="graphic_novel">{m.projects.types.graphic_novel}</SelectItem>
                  <SelectItem value="screenplay">{m.projects.types.screenplay}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-genre">{m.projects.genre}</Label>
                <Input
                  id="edit-genre"
                  onChange={(e) => setEditForm((prev) => ({ ...prev, genre: e.target.value }))}
                  placeholder={m.projects.genrePlaceholder}
                  value={editForm.genre}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-targetWordCount">{m.projects.targetWords}</Label>
                <Input
                  id="edit-targetWordCount"
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, targetWordCount: e.target.value }))
                  }
                  placeholder="50000"
                  type="number"
                  value={editForm.targetWordCount}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-visibility">{m.projects.visibility}</Label>
              <Select
                onValueChange={(value: "private" | "organization" | "public") =>
                  setEditForm((prev) => ({ ...prev, visibility: value }))
                }
                value={editForm.visibility}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">{m.projects.visibilityOptions.private}</SelectItem>
                  <SelectItem value="organization">
                    {m.projects.visibilityOptions.organization}
                  </SelectItem>
                  <SelectItem value="public">{m.projects.visibilityOptions.public}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleCancel} variant="outline">
            {m.common.cancel}
          </Button>
          <Button disabled={updateProjectMutation.isPending} onClick={handleUpdateProject}>
            {updateProjectMutation.isPending ? m.projects.updating : m.projects.update}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
