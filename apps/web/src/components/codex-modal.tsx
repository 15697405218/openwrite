import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  FileText,
  MapPin,
  Save,
  Scroll,
  Settings,
  Sparkles,
  Trash2,
  Users,
  Zap,
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { BindingChecklist } from "@/components/binding-checklist"
import { CharacterDialog } from "@/components/character-dialog"
import { DeleteCharacterDialog } from "@/components/delete-character-dialog"
import { DeleteLocationDialog } from "@/components/delete-location-dialog"
import { LocationDialog } from "@/components/location-dialog"
import { PlotDialog } from "@/components/plot-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { fill, useLocale } from "@/i18n/locale"

import { api, type Character, type Location, type PlotThread, type StoryNote } from "@/lib/api"
import { toastCodexSummary } from "@/lib/codex-summary"

interface CodexModalProps {
  initialEntry?: string | null
  initialType?: string | null
  isOpen: boolean
  onClose: () => void
  projectId: string
}

type CodexEntry = Character | { id: string; name: string; description?: string }

function CodexChapterBinding({
  chapters,
  characterHint,
  locationHint,
  onChange,
  selectedIds,
  selectedType,
}: {
  chapters: { id: string; title: string }[]
  characterHint: string
  locationHint: string
  onChange: (ids: string[]) => void
  selectedIds: string[]
  selectedType: string
}) {
  const { messages: m } = useLocale()
  if (selectedType !== "characters" && selectedType !== "locations") {
    return null
  }

  return (
    <BindingChecklist
      emptyLabel={m.codex.noChaptersToBind}
      group={`modal-${selectedType}-chapters`}
      hint={selectedType === "locations" ? locationHint : characterHint}
      label={m.codex.bindChapters}
      onChange={onChange}
      options={chapters.map((chapter) => ({ id: chapter.id, label: chapter.title }))}
      searchPlaceholder={m.codex.searchBindings}
      selectedIds={selectedIds}
    />
  )
}

export default function CodexModal({
  isOpen,
  onClose,
  projectId,
  initialType = null,
  initialEntry = null,
}: CodexModalProps) {
  const { messages: m } = useLocale()
  const [selectedType, setSelectedType] = useState(initialType || "characters")
  const [selectedEntry, setSelectedEntry] = useState<string | null>(initialEntry)
  const [searchTerm, setSearchTerm] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [createName, setCreateName] = useState("")
  const [createDescription, setCreateDescription] = useState("")
  const [deleteCharacterDialogOpen, setDeleteCharacterDialogOpen] = useState(false)
  const [deleteLocationDialogOpen, setDeleteLocationDialogOpen] = useState(false)
  const [createCharacterDialogOpen, setCreateCharacterDialogOpen] = useState(false)
  const [createLocationDialogOpen, setCreateLocationDialogOpen] = useState(false)
  const [plotDialogOpen, setPlotDialogOpen] = useState(false)
  const [plotDialogMode, setPlotDialogMode] = useState<"create" | "edit">("create")
  const [editingPlot, setEditingPlot] = useState<PlotThread | null>(null)
  const [editChapterIds, setEditChapterIds] = useState<string[]>([])

  const queryClient = useQueryClient()

  // Update state when modal opens with new initial values
  useEffect(() => {
    if (isOpen) {
      setSelectedType(initialType || "characters")
      setSelectedEntry(initialEntry)
      setSearchTerm("")
      setIsCreating(initialType === "notes" && !initialEntry)
      setIsEditing(false)
      setCreateCharacterDialogOpen(false)
      setCreateLocationDialogOpen(false)
    }
  }, [isOpen, initialType, initialEntry])

  // Fetch characters
  const { data: characters = [] } = useQuery({
    queryKey: ["characters", projectId],
    queryFn: async () => {
      const result = await api.characters.list(projectId)
      return result
    },
  })

  // Fetch locations
  const { data: locations = [] } = useQuery({
    queryKey: ["locations", projectId],
    queryFn: async () => {
      const result = await api.locations.list(projectId)
      return result
    },
  })

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", projectId],
    queryFn: () => api.notes.list(projectId),
  })

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", projectId],
    queryFn: () => api.chapters.list(projectId),
    enabled: isOpen,
  })

  const { data: plotThreads = [] } = useQuery({
    queryKey: ["plot", projectId],
    queryFn: () => api.plot.list(projectId),
    enabled: isOpen,
  })

  // Update mutations
  const updateCharacterMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: { chapterIds?: string[]; description: string; name: string }
    }) => {
      const result = await api.characters.update(projectId, id, data)
      return result
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["characters", projectId] })
      toast.success(m.codex.characterUpdated)
      toastCodexSummary(result, m)
      setIsEditing(false)
    },
    onError: (error) => {
      toast.error(fill(m.codex.characterUpdateFailed, { message: error.message }))
    },
  })

  const updateLocationMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: { chapterIds?: string[]; description: string; name: string }
    }) => {
      const result = await api.locations.update(projectId, id, data)
      return result
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["locations", projectId] })
      toast.success(m.codex.locationUpdated)
      toastCodexSummary(result, m)
      setIsEditing(false)
    },
    onError: (error) => {
      toast.error(fill(m.codex.locationUpdateFailed, { message: error.message }))
    },
  })

  const createNoteMutation = useMutation({
    mutationFn: async (data: { description: string; name: string }) =>
      await api.notes.create(projectId, data),
    onSuccess: (_result, data) => {
      queryClient.invalidateQueries({ queryKey: ["notes", projectId] })
      toast.success(m.codex.noteCreated)
      setIsCreating(false)
      setSelectedEntry(data.name)
      setCreateName("")
      setCreateDescription("")
    },
    onError: (error) => {
      toast.error(fill(m.codex.noteSaveFailed, { message: error.message }))
    },
  })

  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { description: string; name: string } }) =>
      await api.notes.update(projectId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", projectId] })
      toast.success(m.codex.noteUpdated)
      setIsEditing(false)
    },
    onError: (error) => {
      toast.error(fill(m.codex.noteSaveFailed, { message: error.message }))
    },
  })

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => await api.notes.delete(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", projectId] })
      toast.success(m.codex.noteDeleted)
      setSelectedEntry(null)
      setIsEditing(false)
    },
    onError: (error) => {
      toast.error(fill(m.codex.noteDeleteFailed, { message: error.message }))
    },
  })

  const savePlotMutation = useMutation({
    mutationFn: async (values: {
      characterIds: string[]
      chapterIds: string[]
      description: string
      order: number
      title: string
    }) => {
      if (plotDialogMode === "edit" && editingPlot) {
        return await api.plot.update(projectId, editingPlot.id, {
          ...values,
          chapterId: values.chapterIds.at(0) ?? null,
          status: editingPlot.status,
          type: editingPlot.type,
        })
      }
      return await api.plot.create(projectId, values)
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["plot", projectId] })
      toast.success(plotDialogMode === "edit" ? m.codex.plotUpdated : m.codex.plotCreated)
      toastCodexSummary(result, m)
      setPlotDialogOpen(false)
      setEditingPlot(null)
    },
    onError: (error) => {
      toast.error(fill(m.codex.plotSaveFailed, { message: error.message }))
    },
  })

  const deletePlotMutation = useMutation({
    mutationFn: async (id: string) => await api.plot.delete(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plot", projectId] })
      toast.success(m.codex.plotDeleted)
      setSelectedEntry(null)
      setIsEditing(false)
    },
    onError: (error) => {
      toast.error(fill(m.codex.plotDeleteFailed, { message: error.message }))
    },
  })

  // Lore entries in this modal are still filled in elsewhere
  const loreEntries: Array<{ id: string; name: string; description: string }> = []

  const getTypeConfig = (typeParam: string) => {
    switch (typeParam) {
      case "characters":
        return {
          title: m.codex.pages.characters.title,
          description: m.codex.pages.characters.description,
          icon: Users,
          entries: characters,
        }
      case "locations":
        return {
          title: m.codex.pages.locations.title,
          description: m.codex.pages.locations.description,
          icon: MapPin,
          entries: locations,
        }
      case "lore":
        return {
          title: m.codex.pages.lore.title,
          description: m.codex.pages.lore.description,
          icon: Scroll,
          entries: loreEntries,
        }
      case "plot":
        return {
          title: m.codex.pages.plot.title,
          description: m.codex.pages.plot.description,
          icon: FileText,
          entries: plotThreads.map((plot) => ({
            id: plot.id,
            name: plot.title,
            description: plot.description,
          })),
        }
      case "notes":
        return {
          title: m.sidebar.notes,
          description: m.codex.notesHint,
          icon: Zap,
          entries: notes.map((note: StoryNote) => ({
            id: note.id,
            name: note.name,
            description: note.description,
          })),
        }
      default:
        return {
          title: m.sidebar.codex,
          description: m.codex.manageElements,
          icon: FileText,
          entries: [],
        }
    }
  }

  const beginEntryEdit = () => {
    if (!selectedEntryData) {
      return
    }
    if (selectedType === "plot" && selectedEntryData.id) {
      const plot = plotThreads.find((item) => item.id === selectedEntryData.id)
      setEditingPlot(plot ?? null)
      setPlotDialogMode("edit")
      setPlotDialogOpen(true)
      return
    }
    setEditName(selectedEntryData.name)
    setEditDescription(selectedEntryData.description || "")
    const character = characters.find((item) => item.id === selectedEntryData.id)
    const place = locations.find((item) => item.id === selectedEntryData.id)
    setEditChapterIds(character?.chapterIds ?? place?.chapterIds ?? [])
    setIsEditing(true)
  }

  const saveEditedEntry = () => {
    if (!selectedEntryData?.id) {
      return
    }
    const updateData = {
      name: editName.trim(),
      description: editDescription.trim(),
    }
    if (selectedType === "characters") {
      updateCharacterMutation.mutate({
        id: selectedEntryData.id,
        data: { ...updateData, chapterIds: editChapterIds },
      })
      return
    }
    if (selectedType === "locations") {
      updateLocationMutation.mutate({
        id: selectedEntryData.id,
        data: { ...updateData, chapterIds: editChapterIds },
      })
      return
    }
    if (selectedType === "notes") {
      updateNoteMutation.mutate({ id: selectedEntryData.id, data: updateData })
      setSelectedEntry(updateData.name)
    }
  }

  const deleteEditedEntry = () => {
    if (selectedType === "characters") {
      setDeleteCharacterDialogOpen(true)
      return
    }
    if (selectedType === "locations") {
      setDeleteLocationDialogOpen(true)
      return
    }
    if (!selectedEntryData?.id) {
      return
    }
    if (selectedType === "notes") {
      deleteNoteMutation.mutate(selectedEntryData.id)
      return
    }
    if (selectedType === "plot") {
      deletePlotMutation.mutate(selectedEntryData.id)
    }
  }

  const config = getTypeConfig(selectedType)
  const IconComponent = config.icon

  const filteredEntries = config.entries.filter((entry) =>
    entry.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleEntryClick = (entryName: string) => {
    setSelectedEntry(entryName)
    setIsCreating(false)
    setIsEditing(false)
  }

  const handleCreateNew = () => {
    if (selectedType === "characters") {
      setCreateCharacterDialogOpen(true)
    } else if (selectedType === "locations") {
      setCreateLocationDialogOpen(true)
    } else if (selectedType === "plot") {
      setEditingPlot(null)
      setPlotDialogMode("create")
      setPlotDialogOpen(true)
    }
    // For other types (lore, notes), keep existing behavior for now
    else {
      setSelectedEntry(null)
      setIsCreating(true)
    }
  }

  const handleClose = () => {
    setSelectedEntry(null)
    setIsCreating(false)
    setIsEditing(false)
    setCreateCharacterDialogOpen(false)
    setCreateLocationDialogOpen(false)
    onClose()
  }

  const getSelectedEntryData = () => {
    if (!selectedEntry) {
      return null
    }
    return config.entries.find((entry) => entry.name === selectedEntry)
  }

  const selectedEntryData = getSelectedEntryData()

  const getEntryIcon = (_entry: CodexEntry, type: string) => {
    switch (type) {
      case "characters":
        return <Users className="h-4 w-4" />
      case "locations":
        return <MapPin className="h-4 w-4" />
      case "lore":
        return <Scroll className="h-4 w-4" />
      case "plot":
        return <FileText className="h-4 w-4" />
      case "notes":
        return <Zap className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const _getEntryTypeFromEntry = (entry: CodexEntry): string => {
    // Since role and type fields are removed, we'll use generic labels
    if ("appearance" in entry || "personality" in entry || "backstory" in entry) {
      return "Character"
    }
    if ("parentLocationId" in entry || "image" in entry) {
      return "Location"
    }
    return "Entry"
  }

  const getEntryRole = (_entry: CodexEntry, type: string): string => {
    // Return generic role based on type since specific role/type fields are removed
    switch (type) {
      case "characters":
        return m.codex.pages.characters.noun
      case "locations":
        return m.codex.pages.locations.noun
      case "lore":
        return m.codex.pages.lore.noun
      case "plot":
        return m.codex.pages.plot.noun
      case "notes":
        return m.sidebar.notes
      default:
        return m.codex.pages.fallback.noun
    }
  }

  // Helper function to render the right panel content
  const renderRightPanel = () => {
    if (isCreating && selectedType === "notes") {
      return (
        <div className="flex h-full flex-col">
          <div className="border-b p-4">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5" />
              <h3 className="font-semibold">
                {fill(m.codex.createNamed, { name: m.sidebar.notes })}
              </h3>
            </div>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            <div className="space-y-2">
              <Label htmlFor="note-name">{m.codex.nameLabel}</Label>
              <Input
                id="note-name"
                onChange={(event) => setCreateName(event.target.value)}
                placeholder={m.codex.namePlaceholder}
                value={createName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note-body">{m.projects.description}</Label>
              <Textarea
                id="note-body"
                onChange={(event) => setCreateDescription(event.target.value)}
                placeholder={m.codex.notesHint}
                rows={6}
                value={createDescription}
              />
            </div>
            <Button
              disabled={createNoteMutation.isPending || createName.trim().length === 0}
              onClick={() =>
                createNoteMutation.mutate({
                  name: createName.trim(),
                  description: createDescription.trim(),
                })
              }
              type="button"
            >
              <Save className="mr-2 h-4 w-4" />
              {m.common.save}
            </Button>
          </div>
        </div>
      )
    }

    if (isCreating) {
      return (
        <div className="flex h-full flex-col">
          <div className="border-b p-4">
            <div className="flex items-center gap-3">
              <IconComponent className="h-5 w-5" />
              <h3 className="font-semibold">{fill(m.codex.createNamed, { name: config.title })}</h3>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="text-center text-muted-foreground">
              <IconComponent className="mx-auto mb-4 h-16 w-16 opacity-20" />
              <h3 className="mb-2 font-semibold">
                {fill(m.codex.createNamed, { name: config.title })}
              </h3>
              <p className="mb-4 text-sm">{fill(m.codex.creationSoon, { name: config.title })}</p>
              <p className="text-xs">{fill(m.codex.creationSidebar, { name: config.title })}</p>
            </div>
          </div>
        </div>
      )
    }

    if (selectedEntryData) {
      return (
        <div className="flex h-full flex-col">
          <div className="border-b p-4">
            <div className="flex items-center gap-3">
              {getEntryIcon(selectedEntryData, selectedType)}
              <div>
                <h3 className="font-semibold">{selectedEntryData.name}</h3>
                <p className="text-muted-foreground text-sm">
                  {getEntryRole(selectedEntryData, selectedType)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <Tabs className="w-full" defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">{m.canvas.overview}</TabsTrigger>
                <TabsTrigger value="details">{m.codex.details}</TabsTrigger>
                <TabsTrigger value="connections">{m.canvas.links}</TabsTrigger>
              </TabsList>

              <TabsContent className="mt-6" value="overview">
                <div className="space-y-6">
                  {isEditing ? (
                    // Edit mode
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-name">{m.codex.nameLabel}</Label>
                        <Input
                          id="edit-name"
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder={m.codex.namePlaceholder}
                          value={editName}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-description">{m.projects.description}</Label>
                        <Textarea
                          id="edit-description"
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder={m.codex.descriptionPlaceholder}
                          rows={4}
                          value={editDescription}
                        />
                      </div>

                      <CodexChapterBinding
                        chapters={chapters}
                        characterHint={m.codex.bindChaptersHint}
                        locationHint={m.codex.bindLocationChaptersHint}
                        onChange={setEditChapterIds}
                        selectedIds={editChapterIds}
                        selectedType={selectedType}
                      />

                      <div className="flex gap-2 pt-4">
                        <Button
                          disabled={
                            updateCharacterMutation.isPending ||
                            updateLocationMutation.isPending ||
                            updateNoteMutation.isPending
                          }
                          onClick={saveEditedEntry}
                          size="sm"
                        >
                          <Save className="mr-2 h-4 w-4" />
                          {updateCharacterMutation.isPending ||
                          updateLocationMutation.isPending ||
                          updateNoteMutation.isPending
                            ? m.auth.updating
                            : m.common.save}
                        </Button>
                        <Button onClick={() => setIsEditing(false)} size="sm" variant="outline">
                          {m.common.cancel}
                        </Button>
                        <Button onClick={deleteEditedEntry} size="sm" variant="destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          {m.common.delete}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <div className="space-y-6">
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <h4 className="font-medium">{m.codex.nameLabel}</h4>
                          <Button onClick={beginEntryEdit} size="sm" variant="outline">
                            {m.common.edit}
                          </Button>
                        </div>
                        <p className="text-muted-foreground text-sm">{selectedEntryData.name}</p>
                      </div>

                      <div>
                        <h4 className="mb-2 font-medium">{m.projects.description}</h4>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          {selectedEntryData.description || m.codex.noDescription}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent className="mt-6" value="details">
                <div className="space-y-6">
                  {/* Character backstory and motivation fields removed - simplified to just name and description */}

                  {selectedType === "locations" && (
                    <div>
                      <h4 className="mb-2 font-medium">{m.codex.locationDetails}</h4>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {selectedEntryData.description || m.codex.noDescription}
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent className="mt-6" value="connections">
                <div className="space-y-4">
                  <h4 className="font-medium">{m.codex.related}</h4>
                  <p className="text-muted-foreground text-sm">{m.codex.relatedSoon}</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )
    }

    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <IconComponent className="mx-auto mb-4 h-16 w-16 opacity-20" />
          <h3 className="mb-2 font-semibold">{config.title}</h3>
          <p className="mb-4 text-muted-foreground text-sm">{config.description}</p>
          <Button onClick={handleCreateNew}>
            {fill(m.codex.createNamed, { name: config.title })}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <Dialog onOpenChange={handleClose} open={isOpen}>
        <DialogContent className="h-[90vh] max-w-[90vw] overflow-hidden p-0 lg:max-w-6xl">
          <div className="flex h-full">
            {/* Left Sidebar - Type Selection */}
            <div className="flex w-64 flex-col border-r bg-muted/50">
              <div className="p-4">
                <DialogHeader>
                  <DialogTitle className="text-left">{m.sidebar.codex}</DialogTitle>
                  <DialogDescription className="text-left">
                    {m.codex.manageElements}
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="space-y-1 p-2">
                  {[
                    {
                      key: "characters",
                      label: m.codex.pages.characters.title,
                      icon: Users,
                      count: characters.length,
                    },
                    {
                      key: "locations",
                      label: m.codex.pages.locations.title,
                      icon: MapPin,
                      count: locations.length,
                    },
                    {
                      key: "lore",
                      label: m.codex.pages.lore.title,
                      icon: Scroll,
                      count: loreEntries.length,
                    },
                    {
                      key: "plot",
                      label: m.codex.pages.plot.title,
                      icon: FileText,
                      count: plotThreads.length,
                    },
                    { key: "notes", label: m.sidebar.notes, icon: Zap, count: notes.length },
                  ].map((item) => (
                    <Button
                      className={`w-full justify-start ${selectedType === item.key ? "bg-accent" : ""}`}
                      key={item.key}
                      onClick={() => {
                        setSelectedType(item.key)
                        setSelectedEntry(null)
                        setIsCreating(false)
                      }}
                      size="sm"
                      variant="ghost"
                    >
                      <item.icon className="mr-3 h-4 w-4" />
                      {item.label}
                      <Badge className="ml-auto" variant="secondary">
                        {item.count}
                      </Badge>
                    </Button>
                  ))}
                </div>

                <Separator className="my-4" />

                <div className="p-4">
                  <div className="space-y-2">
                    <Button
                      className="w-full gap-2"
                      onClick={handleCreateNew}
                      size="sm"
                      variant="outline"
                    >
                      <Sparkles className="h-4 w-4" />
                      {m.codex.createNew}
                    </Button>
                    <Button className="w-full gap-2" size="sm" variant="outline">
                      <Settings className="h-4 w-4" />
                      {m.codex.templates}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Panel - Entry List */}
            <div className="flex w-80 flex-col border-r">
              <div className="border-b p-4">
                <div className="flex items-center gap-3">
                  <IconComponent className="h-5 w-5" />
                  <div>
                    <h3 className="font-semibold">{config.title}</h3>
                    <p className="text-muted-foreground text-xs">{config.description}</p>
                  </div>
                </div>
                <Input
                  className="mt-3"
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={fill(m.codex.search, { name: config.title })}
                  value={searchTerm}
                />
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="space-y-1 p-2">
                  {filteredEntries.map((entry) => (
                    <Card
                      className={`cursor-pointer transition-all hover:bg-accent/50 ${
                        selectedEntry === entry.name ? "bg-accent" : ""
                      }`}
                      key={entry.id}
                      onClick={() => handleEntryClick(entry.name)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            {getEntryIcon(entry, selectedType)}
                            <CardTitle className="text-sm">{entry.name}</CardTitle>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge className="text-xs" variant="outline">
                              {getEntryRole(entry, selectedType)}
                            </Badge>
                          </div>
                        </div>
                        <CardDescription className="line-clamp-2 text-xs">
                          {entry.description?.trim() ? entry.description : m.codex.noDescription}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ))}

                  {filteredEntries.length === 0 && !isCreating && (
                    <div className="py-8 text-center text-muted-foreground">
                      <IconComponent className="mx-auto mb-3 h-12 w-12 opacity-20" />
                      <p className="mb-2 font-medium">
                        {fill(m.codex.noneFound, { name: config.title })}
                      </p>
                      <p className="text-sm">
                        {searchTerm
                          ? m.codex.trySearch
                          : fill(m.codex.createFirst, { name: config.title })}
                      </p>
                      {!searchTerm && (
                        <Button className="mt-3" onClick={handleCreateNew} size="sm">
                          {m.codex.createNew}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Panel - Entry Details/Form */}
            <div className="flex-1">{renderRightPanel()}</div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialogs */}
      {selectedEntryData && selectedType === "characters" && (
        <DeleteCharacterDialog
          character={selectedEntryData as Character}
          onOpenChange={(open) => {
            setDeleteCharacterDialogOpen(open)
            if (!open) {
              setSelectedEntry(null)
              setIsEditing(false)
            }
          }}
          open={deleteCharacterDialogOpen}
          projectId={projectId}
        />
      )}

      {selectedEntryData && selectedType === "locations" && (
        <DeleteLocationDialog
          location={selectedEntryData as Location}
          onOpenChange={(open) => {
            setDeleteLocationDialogOpen(open)
            if (!open) {
              setSelectedEntry(null)
              setIsEditing(false)
            }
          }}
          open={deleteLocationDialogOpen}
          projectId={projectId}
        />
      )}

      {/* Create Dialogs */}
      <CharacterDialog
        mode="create"
        onOpenChange={setCreateCharacterDialogOpen}
        open={createCharacterDialogOpen}
        projectId={projectId}
      />

      <LocationDialog
        mode="create"
        onOpenChange={setCreateLocationDialogOpen}
        open={createLocationDialogOpen}
        projectId={projectId}
      />

      <PlotDialog
        mode={plotDialogMode}
        nextOrder={plotThreads.length + 1}
        onOpenChange={setPlotDialogOpen}
        onSubmit={(values) => savePlotMutation.mutate(values)}
        open={plotDialogOpen}
        plot={editingPlot}
        projectId={projectId}
        saving={savePlotMutation.isPending}
      />
    </>
  )
}
