import { HelpCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { AutocompleteToggle } from "@/components/autocomplete-toggle"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { fill, useLocale } from "@/i18n/locale"

interface StatusBarProps {
  lastSavedText: string
  onShowGuide?: () => void
  wordCount: number
}

export function StatusBar({ wordCount, lastSavedText, onShowGuide }: StatusBarProps) {
  const { locale, messages: m } = useLocale()
  const timeLocale = locale === "zh" ? "zh-CN" : "en"
  const [currentTime, setCurrentTime] = useState(() =>
    new Date().toLocaleTimeString(timeLocale, { hour: "2-digit", minute: "2-digit" })
  )

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString(timeLocale, { hour: "2-digit", minute: "2-digit" }))
    }, 60_000) // Update every minute

    return () => clearInterval(interval)
  }, [timeLocale])

  return (
    <footer className="border-t px-6 py-2">
      <div className="flex items-center justify-between text-muted-foreground text-sm">
        <div className="flex items-center gap-4">
          <span>{fill(m.save.words, { count: wordCount.toLocaleString(timeLocale) })}</span>
          <Separator className="h-4" orientation="vertical" />
          <span>{lastSavedText}</span>
        </div>
        <div className="flex items-center gap-4">
          <span>{currentTime}</span>
          <div className="h-4 w-px bg-border" />
          <AutocompleteToggle />
          {onShowGuide && (
            <Button
              className="h-6 w-6 p-0"
              onClick={onShowGuide}
              size="sm"
              title={m.save.showGuide}
              type="button"
              variant="ghost"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </footer>
  )
}
