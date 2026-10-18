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
import { CharacterDialog } from "@/components/character-dialog"
import { DeleteCharacterDialog } from "@/components/delete-character-dialog"
import { DeleteLocationDialog } from "@/components/delete-location-dialog"
import { LocationDialog } from "@/components/location-dialog"
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

import { api, type Character, type Location } from "@/lib/api"

interface CodexModalProps {
  initialEntry?: string | null
  initialType?: string | null
  isOpen: boolean
  onClose: () => void
  projectId: string
}

type CodexEntry = Character | { id: string; name: string; description?: string }

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
  const [deleteCharacterDialogOpen, setDeleteCharacterDialogOpen] = useState(false)
  const [deleteLocationDialogOpen, setDeleteLocationDialogOpen] = useState(false)
  const [createCharacterDialogOpen, setCreateCharacterDialogOpen] = useState(false)
  const [createLocationDialogOpen, setCreateLocationDialogOpen] = useState(false)

  const queryClient = useQueryClient()

  // Update state when modal opens with new initial values
  useEffect(() => {
    if (isOpen) {
      setSelectedType(initialType || "characters")
      setSelectedEntry(initialEntry)
      setSearchTerm("")
      setIsCreating(false)
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

  // Update mutations
  const updateCharacterMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: { name: string; description: string }
    }) => {
      const result = await api.characters.update(projectId, id, data)
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["characters", projectId] })
      toast.success(m.codex.characterUpdated)
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
      data: { name: string; description: string }
    }) => {
      const result = await api.locations.update(projectId, id, data)
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations", projectId] })
      toast.success(m.codex.locationUpdated)
      setIsEditing(false)
    },
    onError: (error) => {
      toast.error(fill(m.codex.locationUpdateFailed, { message: error.message }))
    },
  })

  // Mock data for lore entries and plot threads - will be replaced with real API calls later
  const loreEntries: Array<{ id: string; name: string; description: string }> = []
  const plotThreads: Array<{ id: string; name: string; description: string }> = []
  const notes: Array<{ id: string; name: string; description: string }> = []

  const getTypeConfig = (typeParam: string) => {
    const blank = m.codex.noDescription
    switch (typeParam) {
      case "characters":
        return {
          title: m.codex.pages.characters.title,
          description: m.codex.pages.characters.description,
          icon: Users,
          entries: characters.map((char) => ({
            ...char,
            description: char.description || blank,
          })),
        }
      case "locations":
        return {
          title: m.codex.pages.locations.title,
          description: m.codex.pages.locations.description,
          icon: MapPin,
          entries: locations.map((location) => ({
            ...location,
            description: location.description || blank,
          })),
        }
      case "lore":
        return {
          title: m.codex.pages.lore.title,
          description: m.codex.pages.lore.description,
          icon: Scroll,
          entries: loreEntries.map((lore) => ({
            ...lore,
            description: lore.description || blank,
          })),
        }
      case "plot":
        return {
          title: m.codex.pages.plot.title,
          description: m.codex.pages.plot.description,
          icon: FileText,
          entries: plotThreads.map((plot) => ({
            ...plot,
            description: plot.description || blank,
          })),
        }
      case "notes":
        return {
          title: m.sidebar.notes,
          description: m.codex.notesHint,
          icon: Zap,
          entries: notes.map((note) => ({
            ...note,
            description: note.description || blank,
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
    }
    // For other types (lore, plot, notes), keep existing behavior for now
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
                <TabsTrigger value="connections">{m.canvas.connections}</TabsTrigger>
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

                      <div className="flex gap-2 pt-4">
                        <Button
                          disabled={
                            updateCharacterMutation.isPending || updateLocationMutation.isPending
                          }
                          onClick={() => {
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
                                data: updateData,
                              })
                            } else if (selectedType === "locations") {
                              updateLocationMutation.mutate({
                                id: selectedEntryData.id,
                                data: updateData,
                              })
                            }
                          }}
                          size="sm"
                        >
                          <Save className="mr-2 h-4 w-4" />
                          {updateCharacterMutation.isPending || updateLocationMutation.isPending
                            ? m.auth.updating
                            : m.common.save}
                        </Button>
                        <Button onClick={() => setIsEditing(false)} size="sm" variant="outline">
                          {m.common.cancel}
                        </Button>
                        <Button
                          onClick={() => {
                            if (selectedType === "characters") {
                              setDeleteCharacterDialogOpen(true)
                            } else if (selectedType === "locations") {
                              setDeleteLocationDialogOpen(true)
                            }
                          }}
                          size="sm"
                          variant="destructive"
                        >
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
                          <Button
                            onClick={() => {
                              setEditName(selectedEntryData.name)
                              setEditDescription(selectedEntryData.description || "")
                              setIsEditing(true)
                            }}
                            size="sm"
                            variant="outline"
                          >
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
                        {selectedEntryData.description}
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
                          {entry.description}
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
    </>
  )
}
