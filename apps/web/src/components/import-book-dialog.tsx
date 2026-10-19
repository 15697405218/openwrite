import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Upload } from "lucide-react"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { fill, type Messages, useLocale } from "@/i18n/locale"
import { fileTitle } from "@/lib/import-book"
import { readableImportFile, runBookImport } from "@/lib/import-book-run"

export function ImportBookDialog() {
  const { messages: m } = useLocale()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState("")

  const chooseFiles = (list: FileList | null) => {
    const next = list ? [...list] : []
    setFiles(next)
    const first = next.at(0)
    if (first && title.trim().length === 0) {
      setTitle(fileTitle(first.name))
    }
  }

  const close = () => {
    if (running) {
      return
    }
    setOpen(false)
  }

  const startImport = async () => {
    if (files.length === 0 || title.trim().length === 0) {
      toast.error(files.length === 0 ? m.projects.importNeedFile : m.projects.titleRequired)
      return
    }
    setRunning(true)
    setProgress("")
    try {
      const loaded = await readChosenFiles(files)
      if (loaded.length === 0) {
        toast.error(m.projects.importNeedFile)
        return
      }
      const imported = await runBookImport({
        defaultVolumeTitle: m.projects.importVolume,
        files: loaded,
        onProgress: (update) => {
          setProgress(
            fill(progressTemplate(m, update.phase), { done: update.done, total: update.total })
          )
        },
        outlineVolumeTitle: m.projects.importOutline,
        title: title.trim(),
      })
      await queryClient.invalidateQueries({ queryKey: ["projects"] })
      setOpen(false)
      setFiles([])
      setTitle("")
      if (imported.missingProvider) {
        toast.error(m.projects.importNoProvider)
      }
      await navigate({
        params: { projectId: imported.projectId },
        to: "/projects/$projectId/write",
      })
    } catch {
      toast.error(m.projects.importFailed)
    } finally {
      setRunning(false)
    }
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!running) {
          setOpen(next)
        }
      }}
      open={open}
    >
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2" type="button" variant="outline">
          <Upload className="h-4 w-4" />
          {m.projects.importAction}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{m.projects.importTitle}</DialogTitle>
          <DialogDescription>{m.projects.importHint}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="import-title">{m.projects.titleLabel}</Label>
            <Input
              id="import-title"
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="import-files">{m.projects.importFiles}</Label>
            <Input
              accept=".txt,.md,text/plain,text/markdown"
              id="import-files"
              multiple
              onChange={(event) => chooseFiles(event.target.files)}
              type="file"
            />
          </div>
          {progress.length > 0 ? <p className="text-muted-foreground text-sm">{progress}</p> : null}
        </div>
        <DialogFooter>
          <Button disabled={running} onClick={close} type="button" variant="outline">
            {m.common.cancel}
          </Button>
          <Button
            disabled={running}
            onClick={() => {
              startImport().catch(() => undefined)
            }}
            type="button"
          >
            {running ? m.projects.importWorking : m.projects.importSubmit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function progressTemplate(messages: Messages, phase: "entries" | "read" | "save"): string {
  if (phase === "save") {
    return messages.projects.importSave
  }
  if (phase === "read") {
    return messages.projects.importRead
  }
  return messages.projects.importEntries
}

async function readChosenFiles(files: File[]): Promise<{ name: string; text: string }[]> {
  const loaded: { name: string; text: string }[] = []
  await readAt(files, 0, loaded)
  return loaded
}

async function readAt(
  files: File[],
  index: number,
  loaded: { name: string; text: string }[]
): Promise<void> {
  const file = files.at(index)
  if (!file) {
    return
  }
  const text = await readableImportFile(file)
  if (text) {
    loaded.push(text)
  }
  await readAt(files, index + 1, loaded)
}
