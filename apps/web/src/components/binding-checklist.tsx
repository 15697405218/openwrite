import type { ReactNode } from "react"
import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface BindingOption {
  disabled?: boolean
  hint?: string
  id: string
  label: string
}

interface BindingChecklistProps {
  action?: ReactNode
  emptyLabel: string
  group: string
  hint: string
  label: string
  onChange: (ids: string[]) => void
  options: BindingOption[]
  searchPlaceholder: string
  selectedIds: string[]
}

export function BindingChecklist({
  label,
  hint,
  emptyLabel,
  group,
  options,
  selectedIds,
  onChange,
  searchPlaceholder,
  action,
}: BindingChecklistProps) {
  const [query, setQuery] = useState("")
  const needle = query.trim().toLowerCase()
  const visible =
    needle.length === 0
      ? options
      : options.filter((option) => option.label.toLowerCase().includes(needle))

  const toggle = (id: string, checked: boolean) => {
    if (checked) {
      if (!selectedIds.includes(id)) {
        onChange([...selectedIds, id])
      }
      return
    }
    onChange(selectedIds.filter((item) => item !== id))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Label>{label}</Label>
          {hint.length > 0 && <p className="text-muted-foreground text-xs">{hint}</p>}
        </div>
        {action}
      </div>
      {options.length > 6 && (
        <Input
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          value={query}
        />
      )}
      {options.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyLabel}</p>
      ) : (
        <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
          {visible.map((option) => (
            <label
              className="flex items-start gap-2 text-sm"
              htmlFor={`${group}-${option.id}`}
              key={option.id}
            >
              <Checkbox
                checked={selectedIds.includes(option.id)}
                disabled={option.disabled}
                id={`${group}-${option.id}`}
                onCheckedChange={(checked) => toggle(option.id, checked === true)}
              />
              <span>
                {option.label}
                {option.hint && (
                  <span className="ml-2 text-muted-foreground text-xs">{option.hint}</span>
                )}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
