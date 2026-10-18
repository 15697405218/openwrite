import type { AiProvider, ProviderId } from "./api/ai-providers"

// Same fallbacks the server uses when a connected provider has no saved model.
const BUILTIN_DEFAULT_MODELS: Partial<Record<ProviderId, string>> = {
  openrouter: "z-ai/glm-5.2:free",
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5",
  groq: "llama-3.3-70b-versatile",
  gemini: "gemini-2.0-flash",
  cohere: "command-r-08-2024",
  ollama: "llama3.2",
}

export function savedDefaultModel(provider: AiProvider): string | undefined {
  const value = provider.providerConfig?.defaultModel
  if (typeof value !== "string") {
    return
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function modelsForProvider(provider: AiProvider): string[] {
  const listed = (provider.supportedModels ?? []).filter((model) => model.trim().length > 0)
  const saved = savedDefaultModel(provider)
  if (listed.length > 0) {
    if (saved && !listed.includes(saved)) {
      return [saved, ...listed]
    }
    return listed
  }
  if (saved) {
    return [saved]
  }
  const builtin = BUILTIN_DEFAULT_MODELS[provider.provider]
  return builtin ? [builtin] : []
}

export function preferredModelId(providers: AiProvider[]): string | undefined {
  const active = providers.filter((provider) => provider.isActive)
  const preferred = active.find((provider) => provider.isDefault) ?? active.at(0)
  if (!preferred) {
    return
  }
  const models = modelsForProvider(preferred)
  const saved = savedDefaultModel(preferred)
  if (saved && models.includes(saved)) {
    return saved
  }
  return models.at(0)
}
