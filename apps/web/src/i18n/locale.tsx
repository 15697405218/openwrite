import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { en, type Messages } from "./en"
import { zh } from "./zh"

export type { Messages } from "./en"
export type Locale = "en" | "zh"

const STORAGE_KEY = "openwrite-locale"

const catalogs: Record<Locale, Messages> = {
  en,
  zh,
}

function readStoredLocale(): Locale {
  if (typeof localStorage === "undefined") {
    return "en"
  }
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === "zh" || stored === "en") {
    return stored
  }
  if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh")) {
    return "zh"
  }
  return "en"
}

interface LocaleContextValue {
  locale: Locale
  messages: Messages
  setLocale: (locale: Locale) => void
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  messages: en,
  setLocale: () => {
    // Default context is English until a provider mounts.
  },
})

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(readStoredLocale)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, locale)
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en"
  }, [locale])

  const value = useMemo(
    () => ({
      locale,
      messages: catalogs[locale],
      setLocale,
    }),
    [locale]
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  return useContext(LocaleContext)
}

export function fill(template: string, vars: Record<string, string | number>) {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, String(value))
  }
  return result
}
