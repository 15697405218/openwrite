import { createFileRoute } from "@tanstack/react-router"
import { Languages, Settings } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type Locale, useLocale } from "@/i18n/locale"

const languageOptions: { locale: Locale; label: string }[] = [
  { locale: "zh", label: "中文" },
  { locale: "en", label: "English" },
]

function OrganizationSettingsPage() {
  const { locale, messages: m, setLocale } = useLocale()

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div>
        <h1 className="font-bold text-3xl">{m.settings.title}</h1>
        <p className="text-muted-foreground">{m.settings.subtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-4 w-4" />
            {m.settings.language}
          </CardTitle>
          <CardDescription>{m.settings.languageHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <fieldset className="flex flex-wrap gap-2 border-0 p-0">
            <legend className="sr-only">{m.settings.language}</legend>
            {languageOptions.map((option) => (
              <Button
                aria-pressed={locale === option.locale}
                key={option.locale}
                onClick={() => setLocale(option.locale)}
                type="button"
                variant={locale === option.locale ? "default" : "outline"}
              >
                {option.label}
              </Button>
            ))}
          </fieldset>
        </CardContent>
      </Card>

      <Alert>
        <Settings className="h-4 w-4" />
        <AlertDescription>{m.settings.comingSoon}</AlertDescription>
      </Alert>
    </div>
  )
}

export const Route = createFileRoute("/dashboard/settings")({
  component: OrganizationSettingsPage,
})
