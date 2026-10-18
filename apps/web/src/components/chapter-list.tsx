import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Network,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { ChapterCreateDialog } from "@/components/chapter-create-dialog"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { fill, useLocale } from "@/i18n/locale"
import { api, type Chapter, type Volume } from "@/lib/api"
import { cn } from "@/lib/utils"

interface ChapterListProps {
  chapters: Chapter[]
  onSelect: (chapterId: string) => void
  projectId: string
  selectedChapterId: string | null
}

export function ChapterList({
  projectId,
  chapters,
  selectedChapterId,
  onSelect,
}: ChapterListProps) {
  const queryClient = useQueryClient()
  const { messages: m } = useLocale()
  const [openVolumeId, setOpenVolumeId] = useState<string | null>(null)

  const { data: volumes = [] } = useQuery({
    queryKey: ["volumes", projectId],
    queryFn: () => api.volumes.list(projectId),
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["chapters", projectId] })
    queryClient.invalidateQueries({ queryKey: ["volumes", projectId] })
  }

  const createVolumeMutation = useMutation({
    mutationFn: async () => {
      const title = fill(m.chapters.volumeName, { count: volumes.length + 1 })
      return await api.volumes.create(projectId, title)
    },
    onSuccess: (result) => {
      setOpenVolumeId(result.id)
      refresh()
    },
    onError: () => toast.error(m.chapters.createVolumeFailed),
  })

  const selectedVolumeId =
    chapters.find((chapter) => chapter.id === selectedChapterId)?.volumeId ?? volumes.at(0)?.id
  const activeVolumeId = openVolumeId === null ? (selectedVolumeId ?? "") : openVolumeId

  return (
    <div className="flex h-full w-60 flex-col border-r bg-muted/20" data-tour="chapters">
      <div className="flex items-center justify-between border-b p-3">
        <span className="font-medium text-sm">{m.chapters.title}</span>
        <Button
          className="h-7 px-2"
          disabled={createVolumeMutation.isPending}
          onClick={() => createVolumeMutation.mutate()}
          size="sm"
          title={m.chapters.newVolume}
          type="button"
          variant="ghost"
        >
          <Plus className="h-4 w-4" />
          <span className="text-xs">{m.chapters.newVolume}</span>
        </Button>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {volumes.length === 0 && (
          <p className="px-2 py-4 text-muted-foreground text-xs">{m.chapters.empty}</p>
        )}

        {volumes.map((volume) => (
          <VolumeBlock
            chapters={chapters.filter((chapter) => chapter.volumeId === volume.id)}
            isOpen={activeVolumeId === volume.id}
            key={volume.id}
            onOpen={() => setOpenVolumeId(activeVolumeId === volume.id ? "" : volume.id)}
            onRefresh={refresh}
            onSelect={onSelect}
            projectId={projectId}
            selectedChapterId={selectedChapterId}
            volume={volume}
          />
        ))}
      </div>

      <div className="border-t p-2" data-tour="story-map">
        <Button
          asChild
          className="w-full justify-start text-muted-foreground"
          size="sm"
          variant="ghost"
        >
          <Link params={{ projectId }} to="/projects/$projectId/canvas">
            <Network className="mr-2 h-4 w-4" />
            {m.chapters.mapStory}
          </Link>
        </Button>
      </div>
    </div>
  )
}

interface VolumeBlockProps {
  chapters: Chapter[]
  isOpen: boolean
  onOpen: () => void
  onRefresh: () => void
  onSelect: (chapterId: string) => void
  projectId: string
  selectedChapterId: string | null
  volume: Volume
}

function VolumeBlock({
  volume,
  chapters,
  isOpen,
  onOpen,
  onRefresh,
  onSelect,
  projectId,
  selectedChapterId,
}: VolumeBlockProps) {
  const { messages: m } = useLocale()
  const [editingVolume, setEditingVolume] = useState(false)
  const [volumeTitle, setVolumeTitle] = useState(volume.title)
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")
  const [createOpen, setCreateOpen] = useState(false)

  const renameVolumeMutation = useMutation({
    mutationFn: async (title: string) => await api.volumes.update(projectId, volume.id, title),
    onSuccess: onRefresh,
    onError: () => toast.error(m.chapters.renameVolumeFailed),
  })

  const deleteVolumeMutation = useMutation({
    mutationFn: async () => await api.volumes.delete(projectId, volume.id),
    onSuccess: onRefresh,
    onError: () => toast.error(m.chapters.deleteVolumeNotEmpty),
  })

  const renameChapterMutation = useMutation({
    mutationFn: async ({ chapterId, title }: { chapterId: string; title: string }) =>
      await api.chapters.update(projectId, chapterId, { title }),
    onSuccess: onRefresh,
    onError: () => toast.error(m.chapters.renameFailed),
  })

  const reorderMutation = useMutation({
    mutationFn: async (chapterIds: string[]) => await api.chapters.reorder(projectId, chapterIds),
    onSuccess: onRefresh,
    onError: () => toast.error(m.chapters.reorderFailed),
  })

  const deleteChapterMutation = useMutation({
    mutationFn: async (chapterId: string) => await api.chapters.delete(projectId, chapterId),
    onSuccess: (_, deletedId) => {
      onRefresh()
      if (selectedChapterId === deletedId) {
        const next = chapters.find((chapter) => chapter.id !== deletedId)
        if (next) {
          onSelect(next.id)
        }
      }
    },
    onError: () => toast.error(m.chapters.deleteFailed),
  })

  const commitVolumeRename = () => {
    if (volumeTitle.trim() && volumeTitle.trim() !== volume.title) {
      renameVolumeMutation.mutate(volumeTitle.trim())
    }
    setEditingVolume(false)
  }

  const commitChapterRename = () => {
    if (editingChapterId && editingTitle.trim()) {
      renameChapterMutation.mutate({ chapterId: editingChapterId, title: editingTitle.trim() })
    }
    setEditingChapterId(null)
  }

  const move = (chapterId: string, direction: -1 | 1) => {
    const ids = chapters.map((chapter) => chapter.id)
    const index = ids.indexOf(chapterId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= ids.length) {
      return
    }
    const displaced = ids[target]
    if (!displaced) {
      return
    }
    ids[index] = displaced
    ids[target] = chapterId
    reorderMutation.mutate(ids)
  }

  return (
    <div className="rounded-md">
      <div className="flex items-center gap-1">
        {editingVolume ? (
          <Input
            autoFocus
            className="h-7 text-sm"
            onBlur={commitVolumeRename}
            onChange={(event) => setVolumeTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                commitVolumeRename()
              }
              if (event.key === "Escape") {
                setEditingVolume(false)
                setVolumeTitle(volume.title)
              }
            }}
            value={volumeTitle}
          />
        ) : (
          <button
            className="flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-1 text-left hover:bg-background/60"
            onClick={onOpen}
            type="button"
          >
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate font-medium text-sm">{volume.title}</span>
            <span className="ml-auto text-muted-foreground text-xs">{chapters.length}</span>
          </button>
        )}
        <Button
          className="h-6 w-6 p-0"
          onClick={() => {
            setVolumeTitle(volume.title)
            setEditingVolume(true)
          }}
          size="sm"
          title={m.chapters.rename}
          type="button"
          variant="ghost"
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          className="h-6 w-6 p-0"
          onClick={() => setCreateOpen(true)}
          size="sm"
          title={m.chapters.new}
          type="button"
          variant="ghost"
        >
          <Plus className="h-3 w-3" />
        </Button>
        {chapters.length === 0 ? (
          <ConfirmDialog
            confirmText={m.common.delete}
            description={fill(m.chapters.deleteVolumeBody, { title: volume.title })}
            onConfirm={() => deleteVolumeMutation.mutate()}
            title={m.chapters.deleteVolumeTitle}
            variant="destructive"
          >
            <Button
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              size="sm"
              title={m.chapters.delete}
              type="button"
              variant="ghost"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </ConfirmDialog>
        ) : null}
      </div>

      <ChapterCreateDialog
        onCreated={(result) => {
          onRefresh()
          onSelect(result.id)
          if (result.previousSummary) {
            toast.success(m.chapters.previousSummaryReady)
          }
        }}
        onOpenChange={setCreateOpen}
        open={createOpen}
        projectId={projectId}
        volumeId={volume.id}
      />

      {isOpen ? (
        <div className="mt-0.5 space-y-0.5 pl-4">
          {chapters.length === 0 ? (
            <p className="px-2 py-2 text-muted-foreground text-xs">{m.chapters.emptyVolume}</p>
          ) : null}
          {chapters.map((chapter, index) => (
            <div
              className={cn(
                "group flex items-center gap-1 rounded-md px-2 py-1.5",
                selectedChapterId === chapter.id
                  ? "bg-background shadow-sm"
                  : "hover:bg-background/60"
              )}
              key={chapter.id}
            >
              {editingChapterId === chapter.id ? (
                <Input
                  autoFocus
                  className="h-7 text-sm"
                  onBlur={commitChapterRename}
                  onChange={(event) => setEditingTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      commitChapterRename()
                    }
                    if (event.key === "Escape") {
                      setEditingChapterId(null)
                    }
                  }}
                  value={editingTitle}
                />
              ) : (
                <>
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onSelect(chapter.id)}
                    type="button"
                  >
                    <span className="block truncate font-medium text-sm">{chapter.title}</span>
                    <span className="block text-muted-foreground text-xs">
                      {fill(m.chapters.words, { count: chapter.wordCount.toLocaleString() })}
                    </span>
                  </button>
                  <div className="hidden shrink-0 items-center group-hover:flex">
                    <Button
                      className="h-6 w-6 p-0"
                      disabled={index === 0 || reorderMutation.isPending}
                      onClick={() => move(chapter.id, -1)}
                      size="sm"
                      title={m.chapters.moveUp}
                      type="button"
                      variant="ghost"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      className="h-6 w-6 p-0"
                      disabled={index === chapters.length - 1 || reorderMutation.isPending}
                      onClick={() => move(chapter.id, 1)}
                      size="sm"
                      title={m.chapters.moveDown}
                      type="button"
                      variant="ghost"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        setEditingChapterId(chapter.id)
                        setEditingTitle(chapter.title)
                      }}
                      size="sm"
                      title={m.chapters.rename}
                      type="button"
                      variant="ghost"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <ConfirmDialog
                      confirmText={m.common.delete}
                      description={fill(m.chapters.deleteBody, { title: chapter.title })}
                      onConfirm={() => deleteChapterMutation.mutate(chapter.id)}
                      title={m.chapters.deleteTitle}
                      variant="destructive"
                    >
                      <Button
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        size="sm"
                        title={m.chapters.delete}
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </ConfirmDialog>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
