import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { ChapterCreateDialog } from "@/components/chapter-create-dialog"
import { ChapterList } from "@/components/chapter-list"
import { GuidedTour, type TourStep, useTour } from "@/components/guided-tour"
import { StatusBar } from "@/components/status-bar"
import TiptapEditor from "@/components/tiptap-editor"
import { Button } from "@/components/ui/button"
import { fill, useLocale } from "@/i18n/locale"
import { clearActiveChapter, setActiveChapter } from "@/lib/active-chapter"
import { getActiveEditor } from "@/lib/active-editor"
import { ApiError, api } from "@/lib/api"
import { setChapterEditHandler } from "@/lib/chapter-edits"
import { type SaveState, type SaveStatusCopy, saveStatusText } from "@/lib/save-status"
import { countWordsInHtml } from "@/lib/word-count"

const AUTOSAVE_DELAY_MS = 1500

function writeTourSteps(m: ReturnType<typeof useLocale>["messages"]): TourStep[] {
  return [
    {
      target: '[data-tour="editor"]',
      title: m.tour.manuscriptTitle,
      body: m.tour.manuscriptBody,
    },
    {
      target: '[data-tour="chapters"]',
      title: m.tour.chaptersTitle,
      body: m.tour.chaptersBody,
    },
    {
      target: '[data-tour="ai-assistant"]',
      title: m.tour.assistantTitle,
      body: m.tour.assistantBody,
    },
    {
      target: '[data-tour="story-map"]',
      title: m.tour.mapTitle,
      body: m.tour.mapBody,
    },
  ]
}

export const Route = createFileRoute("/projects/$projectId/write")({
  component: WriteInterface,
})

function WriteInterface() {
  const { projectId } = Route.useParams()
  const { messages: m } = useLocale()
  const queryClient = useQueryClient()
  const tour = useTour("openwrite-tour-write-v1")
  const saveCopy: SaveStatusCopy = {
    unsaved: m.save.unsaved,
    saving: m.save.saving,
    failed: m.save.failed,
    conflict: m.save.conflict,
    saved: m.save.saved,
    savedAt: (time) => fill(m.save.savedAt, { time }),
    lastSavedAt: (time) => fill(m.save.lastSavedAt, { time }),
    notSaved: m.save.notSaved,
  }

  const { data: chapters = [], isLoading: chaptersLoading } = useQuery({
    queryKey: ["chapters", projectId],
    queryFn: async () => await api.chapters.list(projectId),
  })

  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null)

  useEffect(() => {
    setActiveChapter(projectId, selectedChapterId)
    return () => {
      clearActiveChapter(projectId)
    }
  }, [projectId, selectedChapterId])

  // Select the first chapter once the list loads (or after deletion)
  useEffect(() => {
    if (chapters.length === 0) {
      setSelectedChapterId(null)
      return
    }
    if (!(selectedChapterId && chapters.some((ch) => ch.id === selectedChapterId))) {
      setSelectedChapterId(chapters[0].id)
    }
  }, [chapters, selectedChapterId])

  const { data: doc, isLoading: contentLoading } = useQuery({
    queryKey: ["chapter-content", projectId, selectedChapterId],
    queryFn: async () => {
      if (!selectedChapterId) {
        throw new Error("No chapter selected")
      }
      return await api.chapters.getContent(projectId, selectedChapterId)
    },
    enabled: Boolean(selectedChapterId),
    // The editor is keyed on `doc.updatedAt`; only refetch when we explicitly
    // invalidate (chapter switch or conflict reload) so a background refetch
    // never remounts the editor and drops in-progress edits.
    refetchOnWindowFocus: false,
    staleTime: Number.POSITIVE_INFINITY,
  })

  const [wordCount, setWordCount] = useState(0)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const pendingRef = useRef({ chapterId: "", content: "", dirty: false })
  const timerRef = useRef(0)
  // The `updatedAt` token last seen from the server; echoed back on save so the
  // server can reject a write that would clobber an edit made elsewhere.
  const baseUpdatedAtRef = useRef<string | null>(null)
  // While true, the chapter changed under us — stop autosaving until the writer
  // reloads, so we never overwrite the newer version.
  const conflictRef = useRef(false)

  // Seed word count and last-saved time from the loaded chapter
  useEffect(() => {
    if (doc) {
      setWordCount(countWordsInHtml(doc.content))
      setSavedAt(doc.updatedAt)
      setSaveState("idle")
      baseUpdatedAtRef.current = doc.updatedAt
      conflictRef.current = false
    }
  }, [doc])

  // Discard local edits and pull the latest server version of the chapter.
  const reloadChapter = useCallback(() => {
    conflictRef.current = false
    pendingRef.current.dirty = false
    window.clearTimeout(timerRef.current)
    toast.dismiss()
    queryClient.invalidateQueries({
      queryKey: ["chapter-content", projectId, selectedChapterId],
    })
  }, [projectId, selectedChapterId, queryClient])

  const { mutate: saveContent } = useMutation({
    mutationFn: async ({ chapterId, content }: { chapterId: string; content: string }) =>
      await api.chapters.saveContent(
        projectId,
        chapterId,
        content,
        baseUpdatedAtRef.current ?? undefined
      ),
    onSuccess: (result) => {
      baseUpdatedAtRef.current = result.savedAt
      setSavedAt(result.savedAt)
      setSaveState(pendingRef.current.dirty ? "dirty" : "saved")
      queryClient.invalidateQueries({ queryKey: ["chapters", projectId] })
      queryClient.invalidateQueries({ queryKey: ["project", projectId] })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "stale_content") {
        conflictRef.current = true
        pendingRef.current.dirty = false
        setSaveState("conflict")
        toast.error(m.chapters.editedElsewhere, {
          description: "Reload to get the latest version. Unsaved changes here will be lost.",
          action: { label: "Reload", onClick: reloadChapter },
          duration: Number.POSITIVE_INFINITY,
        })
        return
      }
      pendingRef.current.dirty = true
      setSaveState("error")
    },
  })

  const handleEditorUpdate = useCallback(
    (content: string) => {
      if (!selectedChapterId) {
        return
      }
      setWordCount(countWordsInHtml(content))
      // A reload is required to resolve a conflict; don't keep retrying saves
      // that would just be rejected (or clobber the newer version).
      if (conflictRef.current) {
        return
      }
      pendingRef.current = { chapterId: selectedChapterId, content, dirty: true }
      setSaveState("dirty")
      window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        pendingRef.current.dirty = false
        setSaveState("saving")
        saveContent({
          chapterId: pendingRef.current.chapterId,
          content: pendingRef.current.content,
        })
      }, AUTOSAVE_DELAY_MS)
    },
    [selectedChapterId, saveContent]
  )

  useEffect(() => {
    setChapterEditHandler((edits) => {
      for (const edit of edits) {
        if (edit.chapterId !== selectedChapterId) {
          queryClient.invalidateQueries({
            queryKey: ["chapter-content", projectId, edit.chapterId],
          })
          continue
        }
        window.clearTimeout(timerRef.current)
        baseUpdatedAtRef.current = edit.updatedAt
        pendingRef.current = { chapterId: edit.chapterId, content: edit.content, dirty: false }
        conflictRef.current = false
        const editor = getActiveEditor()
        if (editor) {
          editor.commands.setContent(edit.content, { emitUpdate: false })
        } else {
          queryClient.invalidateQueries({
            queryKey: ["chapter-content", projectId, edit.chapterId],
          })
        }
        setWordCount(countWordsInHtml(edit.content))
        setSavedAt(edit.updatedAt)
        setSaveState("saved")
      }
      if (edits.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["chapters", projectId] })
        queryClient.invalidateQueries({ queryKey: ["project", projectId] })
      }
    })
    return () => setChapterEditHandler(null)
  }, [projectId, queryClient, selectedChapterId])

  // Flush unsaved changes when switching chapters or leaving the page
  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedChapterId intentionally re-arms the cleanup so pending edits flush on chapter switch
  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current)
      if (!conflictRef.current && pendingRef.current.dirty && pendingRef.current.chapterId) {
        pendingRef.current.dirty = false
        api.chapters
          .saveContent(
            projectId,
            pendingRef.current.chapterId,
            pendingRef.current.content,
            baseUpdatedAtRef.current ?? undefined
          )
          .catch((error) => {
            console.error("Failed to save draft on exit:", error)
          })
      }
    },
    [projectId, selectedChapterId]
  )

  const [createChapterOpen, setCreateChapterOpen] = useState(false)

  const summarizeChapter = useMutation({
    mutationFn: async () => {
      if (!selectedChapterId) {
        throw new Error(m.chapters.noSummary)
      }
      return await api.chapters.summarize(projectId, selectedChapterId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapters", projectId] })
      toast.success(m.chapters.summaryReady)
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "no_provider") {
        toast.error(m.chapters.summaryNeedsProvider)
        return
      }
      if (error instanceof ApiError && error.code === "empty_chapter") {
        toast.error(m.chapters.summaryEmpty)
        return
      }
      const message = error instanceof Error ? error.message : m.editor.unknownError
      toast.error(fill(m.chapters.summaryFailed, { message }))
    },
  })

  // A brand-new project has no chapters. Ask once which entries this chapter
  // should carry, instead of creating an unbound chapter in the background.
  const promptedForChapterRef = useRef(false)
  useEffect(() => {
    if (chaptersLoading || chapters.length > 0 || promptedForChapterRef.current) {
      return
    }
    promptedForChapterRef.current = true
    setCreateChapterOpen(true)
  }, [chaptersLoading, chapters.length])

  if (chaptersLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-muted-foreground">{m.chapters.loadingManuscript}</div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <ChapterList
        chapters={chapters}
        liveWordCount={doc ? wordCount : undefined}
        onSelect={setSelectedChapterId}
        projectId={projectId}
        selectedChapterId={selectedChapterId}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <ChapterCreateDialog
          onCreated={(result) => {
            queryClient.invalidateQueries({ queryKey: ["chapters", projectId] })
            queryClient.invalidateQueries({ queryKey: ["volumes", projectId] })
            setSelectedChapterId(result.id)
            if (result.previousSummary) {
              toast.success(m.chapters.previousSummaryReady)
            }
          }}
          onOpenChange={setCreateChapterOpen}
          open={createChapterOpen}
          projectId={projectId}
          volumeTitle={fill(m.chapters.volumeName, { count: 1 })}
        />

        {chapters.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="text-muted-foreground">{m.chapters.firstChapter}</p>
            <Button onClick={() => setCreateChapterOpen(true)} type="button">
              {m.chapters.createFirst}
            </Button>
          </div>
        )}

        {chapters.length > 0 && selectedChapterId && (
          <>
            <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
              <p className="line-clamp-2 text-muted-foreground text-xs">
                {chapters.find((chapter) => chapter.id === selectedChapterId)?.summary?.trim() ||
                  m.chapters.noSummary}
              </p>
              <Button
                disabled={summarizeChapter.isPending}
                onClick={() => summarizeChapter.mutate()}
                size="sm"
                type="button"
                variant="outline"
              >
                {summarizeChapter.isPending ? m.chapters.summarizing : m.chapters.generateSummary}
              </Button>
            </div>
            <div className="flex-1 overflow-auto" data-tour="editor">
              {contentLoading || !doc ? (
                <div className="flex h-full items-center justify-center">
                  <div className="animate-pulse text-muted-foreground">
                    {m.chapters.loadingChapter}
                  </div>
                </div>
              ) : (
                <TiptapEditor
                  content={doc.content}
                  key={`${selectedChapterId}:${doc.updatedAt}`}
                  onUpdate={handleEditorUpdate}
                  placeholder={m.chapters.placeholder}
                  projectId={projectId}
                />
              )}
            </div>
            <StatusBar
              lastSavedText={saveStatusText(saveState, savedAt, saveCopy)}
              onShowGuide={tour.start}
              wordCount={wordCount}
            />
          </>
        )}
      </div>

      {/* First-visit walkthrough; replayable via the ? in the status bar.
          Gated on a loaded editor so targets exist before the tour opens. */}
      <GuidedTour
        onFinish={tour.finish}
        open={tour.open && chapters.length > 0 && Boolean(doc)}
        steps={writeTourSteps(m)}
      />
    </div>
  )
}
