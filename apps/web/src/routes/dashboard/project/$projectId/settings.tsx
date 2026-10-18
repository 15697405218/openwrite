import { createFileRoute } from "@tanstack/react-router"
import { Settings } from "lucide-react"
import { useLocale } from "@/i18n/locale"

export const Route = createFileRoute("/dashboard/project/$projectId/settings")({
  component: ProjectSettingsPage,
})

function ProjectSettingsPage() {
  const { messages: m } = useLocale()
  return (
    <div className="flex-1 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="py-12 text-center">
          <Settings className="mx-auto mb-4 h-16 w-16 opacity-50" />
          <h3 className="mb-2 font-medium text-xl">{m.settings.projectSoonTitle}</h3>
          <p>{m.settings.projectSoonBody}</p>
        </div>
      </div>
    </div>
  )
}
