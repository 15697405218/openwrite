import { Plus } from "lucide-react"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { fill, useLocale } from "@/i18n/locale"

interface AiProviderCardProps {
  children?: React.ReactNode // For the AddProviderForm
  description: string
  enabled: boolean
  isConnected: boolean
  name: string
  onConnect: () => void
  onDelete?: () => void
  recommended?: boolean
}

export function AiProviderCard({
  name,
  description,
  enabled,
  recommended,
  isConnected,
  onConnect,
  onDelete,
  children,
}: AiProviderCardProps) {
  const { messages: m } = useLocale()
  const connectedAction = onDelete ? (
    <ConfirmDialog
      confirmText={m.common.delete}
      description={m.ai.deleteBody}
      onConfirm={onDelete}
      title={m.ai.deleteTitle}
      variant="destructive"
    >
      <Button size="sm" type="button" variant="destructive">
        {m.common.delete}
      </Button>
    </ConfirmDialog>
  ) : (
    <Button disabled size="sm" type="button" variant="destructive">
      {m.common.delete}
    </Button>
  )

  return (
    <Card className={`${enabled ? "" : "opacity-60"} transition-all duration-200 hover:shadow-md`}>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <CardTitle className={`text-base sm:text-lg ${enabled ? "" : "text-muted-foreground"}`}>
              {name}
            </CardTitle>
            <div className="flex flex-wrap gap-1.5">
              {recommended && (
                <Badge className="text-xs" variant="secondary">
                  {m.ai.recommended}
                </Badge>
              )}
              {isConnected && (
                <Badge className="text-xs" variant="default">
                  {m.ai.connectedBadge}
                </Badge>
              )}
              {!enabled && (
                <Badge className="text-xs" variant="outline">
                  {m.ai.comingSoon}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex w-full justify-end sm:w-auto">
            {isConnected ? (
              connectedAction
            ) : (
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    className="w-full sm:w-auto"
                    disabled={!enabled}
                    onClick={onConnect}
                    type="button"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {enabled ? m.ai.connectAction : m.ai.comingSoon}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{fill(m.ai.connect, { name })}</DialogTitle>
                    <DialogDescription>{fill(m.ai.connectModels, { name })}</DialogDescription>
                  </DialogHeader>
                  <div className="max-h-[calc(90vh-8rem)] overflow-y-auto pr-2">{children}</div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
        <CardDescription className={`text-sm ${enabled ? "" : "text-muted-foreground/70"}`}>
          {description}
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
