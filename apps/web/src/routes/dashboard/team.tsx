import { createFileRoute } from "@tanstack/react-router"
import { Users } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useLocale } from "@/i18n/locale"

function TeamPage() {
  const { messages: m } = useLocale()

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div>
        <h1 className="font-bold text-3xl">{m.team.title}</h1>
        <p className="text-muted-foreground">{m.team.subtitle}</p>
      </div>

      <Alert>
        <Users className="h-4 w-4" />
        <AlertDescription>{m.team.comingSoon}</AlertDescription>
      </Alert>
    </div>
  )
}

export const Route = createFileRoute("/dashboard/team")({
  component: TeamPage,
})
