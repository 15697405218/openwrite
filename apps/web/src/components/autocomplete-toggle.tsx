import { useQuery } from "@tanstack/react-query"
import { ChevronDown, Sparkles } from "lucide-react"
import { useEffect, useSyncExternalStore } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useLocale } from "@/i18n/locale"
import { type AiProvider, aiProvidersApi } from "@/lib/api/ai-providers"
import {
  getAutocompleteSnapshot,
  setAutocompleteEnabled,
  setAutocompleteModel,
  subscribeAutocomplete,
} from "@/lib/autocomplete"
import { modelsForProvider, preferredModelId } from "@/lib/provider-models"

interface Model {
  id: string
  name: string
  provider: string
  providerLabel: string
}

interface AutocompleteToggleProps {
  isEnabled?: boolean
  onModelChange?: (model: string, provider: string) => void
  onToggle?: (enabled: boolean) => void
  selectedModel?: string
}

export function AutocompleteToggle({
  isEnabled = false,
  onToggle,
  selectedModel,
  onModelChange,
}: AutocompleteToggleProps) {
  const { messages: m } = useLocale()
  const autocomplete = useSyncExternalStore(
    subscribeAutocomplete,
    getAutocompleteSnapshot,
    getAutocompleteSnapshot
  )
  const autocompleteEnabled = isEnabled || autocomplete.enabled
  const pickedModelId = selectedModel ?? autocomplete.modelId

  // Fetch AI providers
  const { data: providers, isLoading } = useQuery({
    queryKey: ["ai-providers"],
    queryFn: () => aiProvidersApi.list(),
  })

  const allProviders = providers ?? []
  const activeProviders = allProviders.filter((provider: AiProvider) => provider.isActive)
  const hasActiveProviders = activeProviders.length > 0

  useEffect(() => {
    if (selectedModel) {
      setAutocompleteModel(selectedModel)
    }
  }, [selectedModel])

  useEffect(() => {
    if (selectedModel || pickedModelId || !providers) {
      return
    }
    const modelId = preferredModelId(providers)
    if (modelId) {
      setAutocompleteModel(modelId)
    }
  }, [pickedModelId, providers, selectedModel])

  const availableModels: Model[] = activeProviders.flatMap((provider: AiProvider) =>
    modelsForProvider(provider).map((model) => ({
      id: model,
      name: model,
      provider: provider.provider,
      providerLabel: provider.keyLabel || provider.provider,
    }))
  )

  const handleToggle = (enabled: boolean) => {
    setAutocompleteEnabled(enabled)
    onToggle?.(enabled)
  }

  const handleModelSelect = (modelId: string, provider: string) => {
    setAutocompleteModel(modelId)
    onModelChange?.(modelId, provider)
  }

  const currentModel = availableModels.find((model) => model.id === pickedModelId)

  // Helper functions to avoid nested ternaries
  const getTooltipMessage = () => {
    if (!hasActiveProviders) {
      return m.ai.connectForAutocomplete
    }
    return autocompleteEnabled ? m.ai.disableAutocomplete : m.ai.enableAutocomplete
  }

  const renderButtonContent = () => {
    if (currentModel) {
      return (
        <>
          <span className="max-w-24 truncate">{currentModel.name}</span>
          <span className="text-muted-foreground">({currentModel.providerLabel})</span>
        </>
      )
    }
    return m.ai.selectModel
  }

  const renderDropdownContent = () => {
    if (isLoading) {
      return <DropdownMenuItem disabled>{m.ai.loadingModels}</DropdownMenuItem>
    }

    if (availableModels.length === 0) {
      return <DropdownMenuItem disabled>{m.ai.noModels}</DropdownMenuItem>
    }

    return renderModelsByProvider()
  }

  const renderModelsByProvider = () => {
    const providerGroups = availableModels.reduce(
      (groups: Record<string, Model[]>, model: Model) => {
        const key = model.providerLabel
        if (!groups[key]) {
          groups[key] = []
        }
        groups[key].push(model)
        return groups
      },
      {} as Record<string, Model[]>
    )

    return Object.entries(providerGroups).map(([providerLabel, models], index) => (
      <div key={providerLabel}>
        {index > 0 && <DropdownMenuSeparator />}
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          {providerLabel}
        </DropdownMenuLabel>
        {models.map((model) => (
          <DropdownMenuItem
            className="cursor-pointer"
            key={`${model.provider}-${model.id}`}
            onClick={() => handleModelSelect(model.id, model.provider)}
          >
            <div className="flex flex-col">
              <span className="text-sm">{model.name}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </div>
    ))
  }

  return (
    <div className="flex flex-row items-center justify-center gap-3">
      {/* Autocomplete Toggle */}
      <div className="flex flex-row items-center gap-2">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground text-sm">{m.ai.autocomplete}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Switch
              checked={autocompleteEnabled}
              disabled={!hasActiveProviders || isLoading}
              onCheckedChange={handleToggle}
            />
          </TooltipTrigger>
          <TooltipContent side="top">{getTooltipMessage()}</TooltipContent>
        </Tooltip>
      </div>

      {/* Model Selection Dropdown */}
      {autocompleteEnabled && hasActiveProviders && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="h-8 gap-1 px-2 text-xs"
              disabled={!hasActiveProviders || isLoading}
              size="sm"
              variant="outline"
            >
              {renderButtonContent()}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>{m.ai.selectModelMenu}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {renderDropdownContent()}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
