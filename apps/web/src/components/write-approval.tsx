import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { fill, useLocale } from "@/i18n/locale"
import type { WriteProposal } from "@/lib/api/ai"

interface WriteApprovalProps {
  allowDirect: boolean
  busy: boolean
  currentChapterId: string | null
  onDecide: (decisions: { approved: boolean; id: string }[], allowCurrentChapter: boolean) => void
  onRemember: () => void
  pending: WriteProposal[]
  preface: string
}

function choiceLabel(choice: boolean | undefined, allow: string, reject: string): string | null {
  if (choice === true) {
    return allow
  }
  if (choice === false) {
    return reject
  }
  return null
}

export function WriteApproval({
  allowDirect,
  busy,
  currentChapterId,
  onDecide,
  onRemember,
  pending,
  preface,
}: WriteApprovalProps) {
  const { messages: m } = useLocale()
  const pendingKey = pending.map((item) => item.id).join("|")
  const [choiceKey, setChoiceKey] = useState(pendingKey)
  const [choices, setChoices] = useState<Record<string, boolean>>({})
  const rememberRef = useRef(false)
  if (choiceKey !== pendingKey) {
    setChoiceKey(pendingKey)
    setChoices({})
    rememberRef.current = false
  }

  if (pending.length === 0) {
    return null
  }

  const choose = (id: string, approved: boolean, remember: boolean) => {
    if (remember) {
      rememberRef.current = true
      onRemember()
    }
    const next = { ...choices, [id]: approved }
    setChoices(next)
    if (!pending.every((item) => typeof next[item.id] === "boolean")) {
      return
    }
    onDecide(
      pending.map((item) => ({ id: item.id, approved: next[item.id] === true })),
      rememberRef.current || allowDirect
    )
  }

  return (
    <div className="space-y-3">
      {preface.length > 0 && (
        <div className="rounded-lg bg-muted px-3 py-2 text-sm">
          <p className="whitespace-pre-wrap">{preface}</p>
        </div>
      )}
      {pending.map((proposal) => {
        const chosen = choiceLabel(choices[proposal.id], m.ai.writeAllow, m.ai.writeReject)
        const title =
          proposal.action === "append"
            ? fill(m.ai.writeAppend, { title: proposal.chapterTitle })
            : fill(m.ai.writeReplace, { title: proposal.chapterTitle })
        return (
          <div className="rounded-lg border bg-card px-3 py-3 text-sm" key={proposal.id}>
            <p className="font-medium">{title}</p>
            {proposal.action === "replace" && proposal.find.length > 0 && (
              <p className="mt-1 text-muted-foreground text-xs">
                {fill(m.ai.writeFind, { text: proposal.find })}
              </p>
            )}
            <p className="mt-2 whitespace-pre-wrap">{proposal.preview}</p>
            {chosen ? (
              <p className="mt-3 text-muted-foreground text-xs">{chosen}</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  disabled={busy}
                  onClick={() => choose(proposal.id, true, false)}
                  size="sm"
                  type="button"
                >
                  {m.ai.writeAllow}
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => choose(proposal.id, false, false)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {m.ai.writeReject}
                </Button>
                {proposal.chapterId === currentChapterId && (
                  <Button
                    disabled={busy}
                    onClick={() => choose(proposal.id, true, true)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    {m.ai.writeRemember}
                  </Button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
