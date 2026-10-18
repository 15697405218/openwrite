import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { LegalSections } from "@/components/legal-sections"
import { Button } from "@/components/ui/button"
import { legalCopy } from "@/i18n/legal-copy"
import { fill, useLocale } from "@/i18n/locale"

export const Route = createFileRoute("/terms")({
  component: RouteComponent,
})

function RouteComponent() {
  const { locale, messages: m } = useLocale()
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <Button asChild className="mb-4" variant="ghost">
          <Link className="flex items-center gap-2" to="/">
            <ArrowLeft className="h-4 w-4" />
            {m.legal.backHome}
          </Link>
        </Button>
        <h1 className="mb-2 font-bold text-3xl">{m.legal.termsTitle}</h1>
        <p className="text-muted-foreground">
          {fill(m.legal.lastUpdated, {
            date: new Date().toLocaleDateString(locale === "zh" ? "zh-CN" : "en"),
          })}
        </p>
      </div>
      <LegalSections sections={legalCopy(locale).terms} />
    </div>
  )
}
