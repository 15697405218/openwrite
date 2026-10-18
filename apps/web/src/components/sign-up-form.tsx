import { useForm } from "@tanstack/react-form"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import z from "zod"
import { fill, useLocale } from "@/i18n/locale"
import { authClient } from "@/lib/auth-client"
import Loader from "./loader"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

export default function SignUpForm({ onSwitchToSignIn }: { onSwitchToSignIn: () => void }) {
  const navigate = useNavigate({
    from: "/",
  })
  const queryClient = useQueryClient()
  const { isPending } = authClient.useSession()
  const { messages: m } = useLocale()

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
      name: "",
    },
    onSubmit: async ({ value }) => {
      try {
        const result = await authClient.signUp.email(
          {
            email: value.email,
            password: value.password,
            name: value.name,
          },
          {
            onError: (error) => {
              toast.error(error.error.message)
            },
          }
        )

        // Check if sign-up was successful (user object exists)
        if (result && typeof result === "object" && "user" in result && result.user) {
          toast.success(m.auth.signUpSuccess)

          // Function to fetch fresh session data
          const fetchSessionData = async () => {
            const baseUrl =
              import.meta.env.DEV && import.meta.env.VITE_SERVER_URL
                ? import.meta.env.VITE_SERVER_URL
                : window.location.origin

            const response = await fetch(`${baseUrl}/api/session`, {
              credentials: "include",
            })

            if (!response.ok) {
              throw new Error("Failed to fetch session")
            }

            return response.json()
          }

          try {
            // Wait a moment for cookies to be set
            await new Promise((resolve) => setTimeout(resolve, 200))

            // Fetch fresh session data and immediately update the query cache
            const sessionData = await fetchSessionData()

            // Set the session data in the query cache to immediately update all components
            queryClient.setQueryData(["session"], sessionData)

            // Also trigger a refetch to ensure all instances are updated
            queryClient.invalidateQueries({ queryKey: ["session"] })

            // Navigate to dashboard
            navigate({
              to: "/dashboard",
            })
          } catch {
            // Still navigate, dashboard will handle the session check
            navigate({
              to: "/dashboard",
            })
          }
        }
      } catch {
        toast.error(fill(m.auth.failed, { action: m.auth.actionSignUp }))
      }
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(2, m.auth.nameMin),
        email: z.email(m.auth.invalidEmail),
        password: z.string().min(8, m.auth.passwordMin),
      }),
    },
  })

  if (isPending) {
    return <Loader />
  }

  return (
    <div className="mx-auto mt-10 w-full max-w-md p-6">
      <h1 className="mb-6 text-center font-bold text-3xl">{m.auth.createAccountTitle}</h1>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        <div>
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>{m.auth.name}</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  value={field.state.value}
                />
                {field.state.meta.errors.map((error) => (
                  <p className="text-red-500" key={error?.message}>
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </div>

        <div>
          <form.Field name="email">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>{m.auth.email}</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  type="email"
                  value={field.state.value}
                />
                {field.state.meta.errors.map((error) => (
                  <p className="text-red-500" key={error?.message}>
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </div>

        <div>
          <form.Field name="password">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>{m.auth.password}</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  type="password"
                  value={field.state.value}
                />
                {field.state.meta.errors.map((error) => (
                  <p className="text-red-500" key={error?.message}>
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </div>

        <form.Subscribe>
          {(state) => (
            <Button
              className="w-full"
              disabled={!state.canSubmit || state.isSubmitting}
              type="submit"
            >
              {state.isSubmitting ? m.auth.processing : m.auth.signUp}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <div className="mt-4 text-center">
        <Button
          className="text-indigo-600 hover:text-indigo-800"
          onClick={onSwitchToSignIn}
          variant="link"
        >
          {m.auth.hasAccount}
        </Button>
      </div>
    </div>
  )
}
