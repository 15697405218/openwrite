import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLocale } from "@/i18n/locale"
import { authClient } from "@/lib/auth-client"

interface ResetPasswordSearch {
  error: string
  token: string
}

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>): ResetPasswordSearch => ({
    token: typeof search.token === "string" ? search.token : "",
    error: typeof search.error === "string" ? search.error : "",
  }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { messages: m } = useLocale()
  const { token, error } = Route.useSearch()
  const navigate = useNavigate()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const linkInvalid = Boolean(error) || !token

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) {
      return
    }
    if (password.length < 8) {
      toast.error(m.auth.passwordMin)
      return
    }
    if (password !== confirm) {
      toast.error(m.auth.passwordMismatch)
      return
    }
    setSubmitting(true)
    try {
      const result = await authClient.resetPassword({ newPassword: password, token })
      if (result.error) {
        toast.error(result.error.message || m.auth.resetFailed)
        return
      }
      toast.success(m.auth.passwordUpdated)
      navigate({ to: "/login" })
    } catch {
      toast.error(m.auth.resetFailed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="font-bold text-3xl">{m.auth.newPasswordTitle}</h1>
        </div>

        {linkInvalid ? (
          <div className="space-y-4 text-center">
            <p className="rounded-lg border bg-muted/30 p-4 text-sm">{m.auth.linkInvalid}</p>
            <Button asChild className="w-full">
              <Link to="/forgot-password">{m.auth.requestNewLink}</Link>
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="new-password">{m.auth.newPassword}</Label>
              <Input
                id="new-password"
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                value={password}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{m.auth.confirmPassword}</Label>
              <Input
                id="confirm-password"
                onChange={(e) => setConfirm(e.target.value)}
                type="password"
                value={confirm}
              />
            </div>
            <Button
              className="w-full"
              disabled={!(password && confirm) || submitting}
              type="submit"
            >
              {submitting ? m.auth.updating : m.auth.updatePassword}
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
