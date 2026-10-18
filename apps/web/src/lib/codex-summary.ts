import { toast } from "sonner"
import type { Messages } from "@/i18n/en"

export function toastCodexSummary(result: unknown, messages: Messages) {
  if (!result || typeof result !== "object" || !("summaryStatus" in result)) {
    return
  }
  if (result.summaryStatus === "created") {
    toast.success(messages.codex.summaryStored)
    return
  }
  if (result.summaryStatus === "failed") {
    toast.error(messages.codex.summaryFailed)
  }
}
