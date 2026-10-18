import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { BindingChecklist } from "@/components/binding-checklist"
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
import { toastCodexSummary } from "@/lib/codex-summary"

const characterSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  description: z.string().optional(),
  chapterIds: z.array(z.string()),
})

type CharacterFormData = z.infer<typeof characterSchema>

interface CharacterDialogProps {
  character?: Character | null
  mode: "create" | "edit"
  onCreated?: (id: string) => void
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
  onCreated,
}: CharacterDialogProps) {
  const { messages: m } = useLocale()
  const queryClient = useQueryClient()

  const form = useForm<CharacterFormData>({
    resolver: zodResolver(characterSchema),
    defaultValues: {
      name: character?.name || "",
      description: character?.description || "",
      chapterIds: character?.chapterIds ?? [],
    },
  })

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", projectId],
    queryFn: () => api.chapters.list(projectId),
    enabled: open,
  })

  // Reset form when character or mode changes
  useEffect(() => {
    form.reset({
      name: character?.name || "",
      description: character?.description || "",
      chapterIds: character?.chapterIds ?? [],
    })
  }, [character, form])

  const createCharacterMutation = useMutation({
    mutationFn: (data: CharacterFormData) => api.characters.create(projectId, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["characters", projectId] })
      toast.success(m.codex.characterCreated)
      toastCodexSummary(result, m)
      if ("id" in result && typeof result.id === "string") {
        onCreated?.(result.id)
      }
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
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["characters", projectId] })
      toast.success(m.codex.characterUpdated)
      toastCodexSummary(result, m)
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

            <FormField
              control={form.control}
              name="chapterIds"
              render={({ field }) => (
                <FormItem>
                  <BindingChecklist
                    emptyLabel={m.codex.noChaptersToBind}
                    group="character-chapters"
                    hint={m.codex.bindChaptersHint}
                    label={m.codex.bindChapters}
                    onChange={field.onChange}
                    options={chapters.map((chapter) => ({ id: chapter.id, label: chapter.title }))}
                    searchPlaceholder={m.codex.searchBindings}
                    selectedIds={field.value}
                  />
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
