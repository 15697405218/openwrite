interface AutocompleteState {
  enabled: boolean
  modelId?: string
}

let state: AutocompleteState = { enabled: false }
const listeners = new Set<() => void>()

export function getAutocompleteSnapshot(): AutocompleteState {
  return state
}

export function subscribeAutocomplete(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function publish(next: AutocompleteState) {
  state = next
  for (const listener of listeners) {
    listener()
  }
}

export function setAutocompleteEnabled(enabled: boolean) {
  if (state.enabled === enabled) {
    return
  }
  publish({ ...state, enabled })
}

export function setAutocompleteModel(modelId: string) {
  if (state.modelId === modelId) {
    return
  }
  publish({ ...state, modelId })
}
