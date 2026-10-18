import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { fill, useLocale } from "@/i18n/locale"
import { api, type Character } from "@/lib/api"

interface DeleteCharacterDialogProps {
  character: Character
  onOpenChange: (open: boolean) => void
  open: boolean
  projectId: string
}

export function DeleteCharacterDialog({
  open,
  onOpenChange,
  projectId,
  character,
}: DeleteCharacterDialogProps) {
  const { messages: m } = useLocale()
  const queryClient = useQueryClient()

  const deleteCharacterMutation = useMutation({
    mutationFn: () => api.characters.delete(projectId, character.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["characters", projectId] })
      toast.success(fill(m.codex.characterDeleted, { name: character.name }))
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(fill(m.codex.characterDeleteFailed, { message: error.message }))
    },
  })

  const handleDelete = () => {
    deleteCharacterMutation.mutate()
  }

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{m.codex.deleteCharacterTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {fill(m.codex.deleteCharacterBody, { name: character.name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteCharacterMutation.isPending}>
            {m.common.cancel}
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleteCharacterMutation.isPending}
            onClick={handleDelete}
          >
            {deleteCharacterMutation.isPending ? m.codex.deleting : m.codex.deleteCharacterButton}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
