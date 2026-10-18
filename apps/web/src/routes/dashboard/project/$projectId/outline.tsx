import { createFileRoute } from "@tanstack/react-router"
import { FileText } from "lucide-react"
import { useLocale } from "@/i18n/locale"

export const Route = createFileRoute("/dashboard/project/$projectId/outline")({
  component: ProjectOutlinePage,
})

function ProjectOutlinePage() {
  const { messages: m } = useLocale()
  return (
    <div className="flex-1 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="py-12 text-center">
          <FileText className="mx-auto mb-4 h-16 w-16 opacity-50" />
          <h3 className="mb-2 font-medium text-xl">{m.projects.outlineSoonTitle}</h3>
          <p>{m.projects.outlineSoonBody}</p>
        </div>
      </div>
    </div>
  )
}
