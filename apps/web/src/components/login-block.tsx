import { useForm } from "@tanstack/react-form"
import { useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import z from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient, fetchSessionData } from "@/lib/auth-client"
import { fill, useLocale } from "@/i18n/locale"

interface LoginBlockProps {
  mode: "signin" | "signup"
  onModeChange: (mode: "signin" | "signup") => void
}

function fieldErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error
  }
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message
  }
  return "Invalid value"
}

function FieldErrors({ errors }: { errors: readonly unknown[] }) {
  return errors.map((error) => {
    const message = fieldErrorMessage(error)
    return (
      <p className="text-destructive text-sm" key={message}>
        {message}
      </p>
    )
  })
}

export default function LoginBlock({ mode, onModeChange }: LoginBlockProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showPassword, setShowPassword] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const { isPending } = authClient.useSession()
  const { messages: m } = useLocale()

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
      name: mode === "signup" ? "" : undefined,
    },
    onSubmit: async ({ value }) => {
      const actionType = mode === "signin" ? m.auth.actionSignIn : m.auth.actionSignUp
      setSubmitError(null)

      // Attempt authentication with Better Auth (ignoring any thrown errors)
      let authAttempted = false
      try {
        if (mode === "signin") {
          await authClient.signIn.email({
            email: value.email,
            password: value.password,
          })
        } else {
          await authClient.signUp.email({
            email: value.email,
            password: value.password,
            name: value.name ?? "",
          })
        }
        authAttempted = true
      } catch {
        authAttempted = true
        // Continue execution - we'll check session status directly
      }

      if (!authAttempted) {
        const message = fill(m.auth.failed, { action: actionType })
        setSubmitError(message)
        toast.error(message)
        return
      }

      try {
        // Wait a moment for cookies to be set
        await new Promise((resolve) => setTimeout(resolve, 300))

        // Check if authentication actually succeeded by fetching session
        const sessionData = await fetchSessionData()

        if (sessionData?.authenticated && sessionData?.session?.user) {
          // Authentication was successful
          toast.success(mode === "signin" ? m.auth.signInSuccess : m.auth.signUpSuccess)

          // Set the session data in the query cache to immediately update all components
          queryClient.setQueryData(["session"], sessionData)

          // Force all components to re-render by invalidating and refetching
          await queryClient.invalidateQueries({ queryKey: ["session"] })
          await queryClient.refetchQueries({
            queryKey: ["session"],
            type: "all",
          })

          // Navigate to dashboard
          navigate({
            to: "/dashboard",
          })
        } else {
          const message = fill(m.auth.checkCredentials, { action: actionType })
          setSubmitError(message)
          toast.error(message)
        }
      } catch {
        const message = fill(m.auth.tryAgain, { action: actionType })
        setSubmitError(message)
        toast.error(message)
      }
    },
    validators: {
      onSubmit: ({ value }) => {
        const schema =
          mode === "signin"
            ? z.object({
                email: z.string().email(m.auth.invalidEmail),
                password: z.string().min(8, m.auth.passwordMin),
              })
            : z.object({
                email: z.string().email(m.auth.invalidEmail),
                password: z.string().min(8, m.auth.passwordMin),
                name: z.string().min(2, m.auth.nameMin),
              })

        const result = schema.safeParse(value)
        if (result.success) {
          return
        }

        const fields: { email?: string; name?: string; password?: string } = {}
        for (const issue of result.error.issues) {
          const key = issue.path[0]
          if (key === "email" || key === "name" || key === "password") {
            fields[key] ??= issue.message
          }
        }
        return { fields }
      },
    },
  })

  if (isPending) {
    return (
      <div className="flex min-h-[80vh] w-full items-center justify-center px-4 py-6">
        <div className="text-center">{m.common.loading}</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[80vh] w-full items-center justify-center px-4 py-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex flex-col items-center text-center">
            <h1 className="font-semibold text-xl tracking-tight">
              {mode === "signin" ? m.auth.welcomeBack : m.auth.createAccountTitle}
            </h1>
            <p className="text-muted-foreground text-sm">
              {mode === "signin" ? m.auth.signInHint : m.auth.signUpHint}
            </p>
          </div>

          {/* Form */}
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg">
                {mode === "signin" ? m.auth.signInCard : m.auth.signUpCard}
              </CardTitle>
              <CardDescription>
                {mode === "signin" ? m.auth.signInCardHint : m.auth.signUpCardHint}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  form.handleSubmit()
                }}
              >
                {mode === "signup" && (
                  <div className="space-y-2">
                    <form.Field name="name">
                      {(field) => (
                        <>
                          <Label htmlFor={field.name}>{m.auth.name}</Label>
                          <Input
                            id={field.name}
                            name={field.name}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder={m.auth.namePlaceholder}
                            value={field.state.value || ""}
                          />
                          <FieldErrors errors={field.state.meta.errors} />
                        </>
                      )}
                    </form.Field>
                  </div>
                )}

                <div className="space-y-2">
                  <form.Field name="email">
                    {(field) => (
                      <>
                        <Label htmlFor={field.name}>{m.auth.email}</Label>
                        <Input
                          id={field.name}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder={m.auth.emailPlaceholder}
                          type="email"
                          value={field.state.value}
                        />
                        <FieldErrors errors={field.state.meta.errors} />
                      </>
                    )}
                  </form.Field>
                </div>

                <div className="space-y-2">
                  <form.Field name="password">
                    {(field) => (
                      <>
                        <Label htmlFor={field.name}>{m.auth.password}</Label>
                        <div className="relative">
                          <Input
                            id={field.name}
                            name={field.name}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder={m.auth.passwordPlaceholder}
                            type={showPassword ? "text" : "password"}
                            value={field.state.value}
                          />
                          <Button
                            className="absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <FieldErrors errors={field.state.meta.errors} />
                      </>
                    )}
                  </form.Field>
                </div>

                {mode === "signin" && (
                  <div className="text-right">
                    <Link
                      className="text-muted-foreground text-sm underline-offset-4 hover:text-primary hover:underline"
                      to="/forgot-password"
                    >
                      {m.auth.forgot}
                    </Link>
                  </div>
                )}

                {submitError ? <p className="text-destructive text-sm">{submitError}</p> : null}

                <form.Subscribe>
                  {(state) => (
                    <Button
                      className="w-full"
                      disabled={!state.canSubmit || state.isSubmitting}
                      type="submit"
                    >
                      {(() => {
                        if (state.isSubmitting) {
                          return m.auth.processing
                        }
                        return mode === "signin" ? m.auth.signIn : m.auth.createAccount
                      })()}
                    </Button>
                  )}
                </form.Subscribe>
              </form>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center text-sm">
            {mode === "signin" ? (
              <>
                {m.auth.noAccount}{" "}
                <Button
                  className="h-auto p-0 font-semibold"
                  onClick={() => onModeChange("signup")}
                  variant="link"
                >
                  {m.auth.signUp}
                </Button>
              </>
            ) : (
              <>
                {m.auth.hasAccount}{" "}
                <Button
                  className="h-auto p-0 font-semibold"
                  onClick={() => onModeChange("signin")}
                  variant="link"
                >
                  {m.auth.signIn}
                </Button>
              </>
            )}
          </div>

          <p className="px-2 text-center text-muted-foreground text-sm">
            {m.auth.agree}{" "}
            <Link className="underline underline-offset-4 hover:text-primary" to="/terms">
              {m.auth.terms}
            </Link>{" "}
            {m.auth.and}{" "}
            <Link className="underline underline-offset-4 hover:text-primary" to="/privacy">
              {m.auth.privacy}
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
