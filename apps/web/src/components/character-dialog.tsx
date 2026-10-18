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
import { api, type Character } from "@/lib/api"

const characterSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  description: z.string().optional(),
  // role field removed - users can describe character roles freely in description
  // appearance, personality, backstory, motivation removed - simplified to just name and description
})

type CharacterFormData = z.infer<typeof characterSchema>

interface CharacterDialogProps {
  character?: Character | null
  mode: "create" | "edit"
  onOpenChange: (open: boolean) => void
  open: boolean
  projectId: string
}

export function CharacterDialog({
  open,
  onOpenChange,
  projectId,
  character,
  mode,
}: CharacterDialogProps) {
  const { messages: m } = useLocale()
  const queryClient = useQueryClient()

  const form = useForm<CharacterFormData>({
    resolver: zodResolver(characterSchema),
    defaultValues: {
      name: character?.name || "",
      description: character?.description || "",
      // role field removed
      // appearance, personality, backstory, motivation removed - simplified to just name and description
    },
  })

  // Reset form when character or mode changes
  useEffect(() => {
    form.reset({
      name: character?.name || "",
      description: character?.description || "",
      // role field removed
      // appearance, personality, backstory, motivation removed - simplified to just name and description
    })
  }, [character, form])

  const createCharacterMutation = useMutation({
    mutationFn: (data: CharacterFormData) => api.characters.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["characters", projectId] })
      toast.success(m.codex.characterCreated)
      onOpenChange(false)
      form.reset()
    },
    onError: (error) => {
      toast.error(fill(m.codex.characterCreateFailed, { message: error.message }))
    },
  })

  const updateCharacterMutation = useMutation({
    mutationFn: (data: CharacterFormData) => {
      if (!character?.id) {
        throw new Error("Character ID is required for updates")
      }
      return api.characters.update(projectId, character.id, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["characters", projectId] })
      toast.success(m.codex.characterUpdated)
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(fill(m.codex.characterUpdateFailed, { message: error.message }))
    },
  })

  const onSubmit = (data: CharacterFormData) => {
    if (mode === "create") {
      createCharacterMutation.mutate(data)
    } else {
      updateCharacterMutation.mutate(data)
    }
  }

  const isLoading = createCharacterMutation.isPending || updateCharacterMutation.isPending

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? m.codex.createCharacter
              : fill(m.codex.editNamed, { name: character?.name ?? "" })}
          </DialogTitle>
          <DialogDescription>
            {mode === "create" ? m.codex.addCharacterHint : m.codex.updateCharacterHint}
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
                    <Input {...field} name="character_name" placeholder={m.codex.characterName} />
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
                      className="min-h-[80px]"
                      placeholder={m.codex.characterDescription}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Appearance, personality, backstory, motivation fields removed - simplified to just name and description */}

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
                  return mode === "create" ? m.codex.createCharacterButton : m.codex.updateCharacter
                })()}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
