import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient } from "@/lib/auth-client"
import { fill, useLocale } from "@/i18n/locale"

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const { messages: m } = useLocale()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || submitting) {
      return
    }
    setSubmitting(true)
    try {
      await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: "/reset-password",
      })
    } finally {
      // Always show the same confirmation to avoid revealing which emails exist
      setSubmitted(true)
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="font-bold text-3xl">{m.auth.resetTitle}</h1>
          <p className="text-muted-foreground text-sm">{m.auth.resetHint}</p>
        </div>

        {submitted ? (
          <p className="rounded-lg border bg-muted/30 p-4 text-center text-sm">
            {fill(m.auth.resetSent, { email })}
          </p>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">{m.auth.email}</Label>
              <Input
                id="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder={m.auth.emailPlaceholder}
                type="email"
                value={email}
              />
            </div>
            <Button className="w-full" disabled={!email.trim() || submitting} type="submit">
              {submitting ? m.auth.sending : m.auth.sendReset}
            </Button>
          </form>
        )}

        <p className="text-center text-muted-foreground text-sm">
          <Link className="underline-offset-4 hover:text-primary hover:underline" to="/login">
            {m.auth.backToSignIn}
          </Link>
        </p>
      </div>
    </div>
  )
}
