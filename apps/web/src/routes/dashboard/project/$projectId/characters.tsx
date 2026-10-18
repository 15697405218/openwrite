import { createFileRoute } from "@tanstack/react-router"
import { Users } from "lucide-react"
import { useLocale } from "@/i18n/locale"

export const Route = createFileRoute("/dashboard/project/$projectId/characters")({
  component: ProjectCharactersPage,
})

function ProjectCharactersPage() {
  const { messages: m } = useLocale()
  return (
    <div className="flex-1 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="py-12 text-center">
          <Users className="mx-auto mb-4 h-16 w-16 opacity-50" />
          <h3 className="mb-2 font-medium text-xl">{m.projects.charactersSoonTitle}</h3>
          <p>{m.projects.charactersSoonBody}</p>
        </div>
      </div>
    </div>
  )
}
