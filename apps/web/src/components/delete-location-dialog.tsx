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
import { api, type Location } from "@/lib/api"

interface DeleteLocationDialogProps {
  location: Location
  onOpenChange: (open: boolean) => void
  open: boolean
  projectId: string
}

export function DeleteLocationDialog({
  open,
  onOpenChange,
  location,
  projectId,
}: DeleteLocationDialogProps) {
  const { messages: m } = useLocale()
  const queryClient = useQueryClient()

  const deleteLocationMutation = useMutation({
    mutationFn: () => api.locations.delete(projectId, location.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations", projectId] })
      toast.success(fill(m.codex.locationDeleted, { name: location.name }))
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(fill(m.codex.locationDeleteFailed, { message: error.message }))
    },
  })

  const handleDelete = () => {
    deleteLocationMutation.mutate()
  }

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{m.codex.deleteLocationTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {fill(m.codex.deleteLocationBody, { name: location.name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteLocationMutation.isPending}>
            {m.common.cancel}
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleteLocationMutation.isPending}
            onClick={handleDelete}
          >
            {deleteLocationMutation.isPending ? m.codex.deleting : m.codex.deleteLocationButton}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
