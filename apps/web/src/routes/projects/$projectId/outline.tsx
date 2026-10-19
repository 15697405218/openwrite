import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useLocale } from "@/i18n/locale"
import { clearPageFocus, setPageFocus } from "@/lib/active-chapter"
import { api, type ProjectOutline } from "@/lib/api"

export const Route = createFileRoute("/projects/$projectId/outline")({
  component: OutlinePage,
})

function OutlinePage() {
  const { projectId } = Route.useParams()
  const { messages: m } = useLocale()
  useEffect(() => {
    setPageFocus(projectId, "outline", null)
    return () => {
      clearPageFocus(projectId)
    }
  }, [projectId])
  const { data, isLoading } = useQuery({
    queryKey: ["outline", projectId],
    queryFn: () => api.outline.get(projectId),
  })

  if (isLoading || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-muted-foreground">{m.common.loading}</div>
      </div>
    )
  }

  return <OutlineEditor key={data.id} outline={data} projectId={projectId} />
}

function OutlineEditor({ outline, projectId }: { outline: ProjectOutline; projectId: string }) {
  const { messages: m } = useLocale()
  const queryClient = useQueryClient()
  const [body, setBody] = useState(outline.body)
  const [seen, setSeen] = useState(outline.body)
  if (outline.body !== seen) {
    setSeen(outline.body)
    if (body === seen) {
      setBody(outline.body)
    }
  }
  const save = useMutation({
    mutationFn: async () => await api.outline.save(projectId, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["outline", projectId] })
      toast.success(m.outline.saved)
    },
    onError: () => toast.error(m.outline.saveFailed),
  })

  return (
    <form
      className="mx-auto flex h-full max-w-3xl flex-col gap-6 overflow-auto p-8"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <h1 className="font-semibold text-2xl">{m.outline.title}</h1>
      <div className="space-y-2">
        <Label htmlFor="outline-body">{m.outline.bodyLabel}</Label>
        <Textarea
          className="min-h-96"
          id="outline-body"
          onChange={(event) => setBody(event.target.value)}
          value={body}
        />
      </div>
      <div>
        <Button disabled={save.isPending} type="submit">
          {save.isPending ? m.common.saving : m.common.save}
        </Button>
      </div>
    </form>
  )
}
