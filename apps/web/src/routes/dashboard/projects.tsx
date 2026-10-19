import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { BookOpen, Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { EditProjectDialog } from "@/components/edit-project-dialog"
import { ImportBookDialog } from "@/components/import-book-dialog"
import { ProjectCard } from "@/components/project-card"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

export const Route = createFileRoute("/dashboard/projects")({
  component: ProjectsPage,
})

interface CreateProjectForm {
  description: string
  genre: string
  targetWordCount: string
  title: string
  type: "novel" | "trilogy" | "series" | "short_story_collection" | "graphic_novel" | "screenplay"
  visibility: "private" | "organization" | "public"
}

function ProjectsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { messages: m } = useLocale()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [createForm, setCreateForm] = useState<CreateProjectForm>({
    title: "",
    description: "",
    type: "novel",
    genre: "",
    targetWordCount: "",
    visibility: "private",
  })

  // Fetch projects
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const result = await api.projects.list()
      return result
    },
  })

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: CreateProjectForm) => {
      const result = await api.projects.create({
        title: data.title,
        description: data.description || null,
        type: data.type,
        genre: data.genre || null,
        targetWordCount: data.targetWordCount ? Number.parseInt(data.targetWordCount, 10) : null,
        visibility: data.visibility,
      })
      return result
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
      setIsCreateDialogOpen(false)
      setCreateForm({
        title: "",
        description: "",
        type: "novel",
        genre: "",
        targetWordCount: "",
        visibility: "private",
      })
      // Drop new writers straight into the editor instead of back on the list
      navigate({ to: "/projects/$projectId/write", params: { projectId: result.id } })
    },
    onError: (_error) => {
      toast.error(m.projects.createFailed)
    },
  })

  const handleCreateProject = () => {
    if (!createForm.title.trim()) {
      toast.error(m.projects.titleRequired)
      return
    }
    createProjectMutation.mutate(createForm)
  }

  if (isLoading) {
    return (
      <div className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-lg">{m.common.loading}</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col space-y-6">
          {/* Breadcrumb */}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{m.projects.breadcrumb}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Title and Action */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-bold text-3xl">{m.projects.title}</h1>
              <p className="mt-2">{m.projects.manage}</p>
            </div>

            <div className="flex items-center gap-2">
              <ImportBookDialog />
              <Dialog onOpenChange={setIsCreateDialogOpen} open={isCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    {m.projects.new}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>{m.projects.createTitle}</DialogTitle>
                    <DialogDescription>{m.projects.createHint}</DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">{m.projects.titleLabel}</Label>
                      <Input
                        id="title"
                        onChange={(e) =>
                          setCreateForm((prev) => ({ ...prev, title: e.target.value }))
                        }
                        placeholder={m.projects.titlePlaceholder}
                        value={createForm.title}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">{m.projects.description}</Label>
                      <Textarea
                        id="description"
                        onChange={(e) =>
                          setCreateForm((prev) => ({ ...prev, description: e.target.value }))
                        }
                        placeholder={m.projects.descriptionPlaceholder}
                        value={createForm.description}
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="type">{m.projects.type}</Label>
                        <Select
                          onValueChange={(
                            value:
                              | "novel"
                              | "trilogy"
                              | "series"
                              | "short_story_collection"
                              | "graphic_novel"
                              | "screenplay"
                          ) => setCreateForm((prev) => ({ ...prev, type: value }))}
                          value={createForm.type}
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
                            <SelectItem value="graphic_novel">
                              {m.projects.types.graphic_novel}
                            </SelectItem>
                            <SelectItem value="screenplay">
                              {m.projects.types.screenplay}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="genre">{m.projects.genre}</Label>
                          <Input
                            id="genre"
                            onChange={(e) =>
                              setCreateForm((prev) => ({ ...prev, genre: e.target.value }))
                            }
                            placeholder={m.projects.genrePlaceholder}
                            value={createForm.genre}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="targetWordCount">{m.projects.targetWords}</Label>
                          <Input
                            id="targetWordCount"
                            onChange={(e) =>
                              setCreateForm((prev) => ({
                                ...prev,
                                targetWordCount: e.target.value,
                              }))
                            }
                            placeholder="50000"
                            type="number"
                            value={createForm.targetWordCount}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="visibility">{m.projects.visibility}</Label>
                        <Select
                          onValueChange={(value: "private" | "organization" | "public") =>
                            setCreateForm((prev) => ({ ...prev, visibility: value }))
                          }
                          value={createForm.visibility}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="private">
                              {m.projects.visibilityOptions.private}
                            </SelectItem>
                            <SelectItem value="organization">
                              {m.projects.visibilityOptions.organization}
                            </SelectItem>
                            <SelectItem value="public">
                              {m.projects.visibilityOptions.public}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button onClick={() => setIsCreateDialogOpen(false)} variant="outline">
                      {m.common.cancel}
                    </Button>
                    <Button
                      disabled={createProjectMutation.isPending}
                      onClick={handleCreateProject}
                    >
                      {createProjectMutation.isPending ? m.projects.creating : m.projects.create}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Projects Grid */}
        {projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project: Project) => (
              <ProjectCard key={project.id} onEdit={setEditingProject} project={project} />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <BookOpen className="mx-auto mb-4 h-16 w-16 opacity-50" />
            <h3 className="mb-2 font-medium text-xl">{m.projects.emptyTitle}</h3>
            <p className="mb-6">{m.projects.emptyBody}</p>
            <div className="flex items-center justify-center gap-2">
              <ImportBookDialog />
              <Button
                className="flex items-center gap-2"
                onClick={() => setIsCreateDialogOpen(true)}
                type="button"
              >
                <Plus className="h-4 w-4" />
                {m.dashboard.createFirst}
              </Button>
            </div>
          </div>
        )}

        {/* Edit Project Dialog */}
        {editingProject && (
          <EditProjectDialog
            onOpenChange={(open) => {
              if (!open) {
                setEditingProject(null)
              }
            }}
            open={!!editingProject}
            project={editingProject}
          />
        )}
      </div>
    </div>
  )
}
