import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { fill, useLocale } from "@/i18n/locale"
import { api, type Location } from "@/lib/api"

const locationSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  description: z.string().optional(),
  // type field removed - users can describe location types freely in description
  parentLocationId: z.string().optional(),
  image: z.string().optional(),
})

type LocationFormData = z.infer<typeof locationSchema>

interface LocationDialogProps {
  location?: Location | null
  mode: "create" | "edit"
  onOpenChange: (open: boolean) => void
  open: boolean
  projectId: string
}

export function LocationDialog({
  open,
  onOpenChange,
  projectId,
  location,
  mode,
}: LocationDialogProps) {
  const { messages: m } = useLocale()
  const queryClient = useQueryClient()

  const form = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: location?.name || "",
      description: location?.description || "",
      // type field removed
      parentLocationId: location?.parentLocationId || "",
      image: location?.image || "",
    },
  })

  // Reset form when location or mode changes
  useEffect(() => {
    form.reset({
      name: location?.name || "",
      description: location?.description || "",
      // type field removed
      parentLocationId: location?.parentLocationId || "",
      image: location?.image || "",
    })
  }, [location, form])

  const createLocationMutation = useMutation({
    mutationFn: (data: LocationFormData) => api.locations.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations", projectId] })
      toast.success(m.codex.locationCreated)
      onOpenChange(false)
      form.reset()
    },
    onError: (error) => {
      toast.error(fill(m.codex.locationCreateFailed, { message: error.message }))
    },
  })

  const updateLocationMutation = useMutation({
    mutationFn: (data: LocationFormData) => {
      if (!location?.id) {
        throw new Error("Location ID is required for updates")
      }
      return api.locations.update(projectId, location.id, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations", projectId] })
      toast.success(m.codex.locationUpdated)
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(fill(m.codex.locationUpdateFailed, { message: error.message }))
    },
  })

  const onSubmit = (data: LocationFormData) => {
    if (mode === "create") {
      createLocationMutation.mutate(data)
    } else {
      updateLocationMutation.mutate(data)
    }
  }

  const isLoading = createLocationMutation.isPending || updateLocationMutation.isPending

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? m.codex.createLocation
              : fill(m.codex.editNamed, { name: location?.name ?? "" })}
          </DialogTitle>
          <DialogDescription>
            {mode === "create" ? m.codex.addLocationHint : m.codex.updateLocationHint}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{m.codex.nameLabel}</FormLabel>
                  <FormControl>
                    <Input {...field} name="location_name" placeholder={m.codex.locationName} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{m.projects.description}</FormLabel>
                  <FormControl>
                    <Textarea
                      className="min-h-[100px]"
                      placeholder={m.codex.locationDescription}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="parentLocationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{m.codex.parentLocation}</FormLabel>
                  <FormControl>
                    <Input placeholder={m.codex.parentPlaceholder} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="image"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{m.codex.imageUrl}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={`https://example.com/image.jpg (${m.common.optional})`}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                disabled={isLoading}
                onClick={() => onOpenChange(false)}
                type="button"
                variant="outline"
              >
                {m.common.cancel}
              </Button>
              <Button disabled={isLoading} type="submit">
                {(() => {
                  if (isLoading) {
                    return m.codex.saving
                  }
                  return mode === "create" ? m.codex.createLocationButton : m.codex.updateLocation
                })()}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
