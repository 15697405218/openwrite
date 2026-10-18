import { describe, expect, it } from "vitest"
import type { AiProvider } from "../api/ai-providers"
import { modelsForProvider, preferredModelId } from "../provider-models"

function provider(overrides: Partial<AiProvider> & Pick<AiProvider, "provider">): AiProvider {
  return {
    createdAt: "",
    currentUsage: 0,
    id: "provider-1",
    isActive: true,
    isDefault: false,
    keyHash: null,
    keyLabel: "Custom endpoint",
    lastUsedAt: null,
    providerConfig: null,
    supportedModels: null,
    usageLimit: null,
    usageRemaining: null,
    ...overrides,
  }
}

describe("modelsForProvider", () => {
  it("uses the model saved when a custom endpoint was connected", () => {
    const custom = provider({
      provider: "custom",
      providerConfig: { defaultModel: "deepseek-chat" },
    })

    expect(modelsForProvider(custom)).toEqual(["deepseek-chat"])
  })

  it("keeps an explicit model list and still prefers the saved model", () => {
    const openai = provider({
      provider: "openai",
      providerConfig: { defaultModel: "gpt-4.1" },
      supportedModels: ["gpt-4o-mini", "gpt-4.1"],
    })

    expect(modelsForProvider(openai)).toEqual(["gpt-4o-mini", "gpt-4.1"])
    expect(preferredModelId([openai])).toBe("gpt-4.1")
  })

  it("falls back to the built-in model when nothing was saved", () => {
    expect(modelsForProvider(provider({ provider: "openai" }))).toEqual(["gpt-4o-mini"])
  })
})

describe("preferredModelId", () => {
  it("reads the default provider's saved model", () => {
    const other = provider({
      id: "other",
      provider: "openai",
      isDefault: false,
    })
    const custom = provider({
      id: "custom",
      provider: "custom",
      isDefault: true,
      providerConfig: { defaultModel: "qwen2.5" },
    })

    expect(preferredModelId([other, custom])).toBe("qwen2.5")
  })
})
