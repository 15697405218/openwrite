/**
 * Base API client utility for making authenticated requests
 */

import type { ChapterEdit } from "@/lib/chapter-edits"

const BASE_URL =
  import.meta.env.DEV && import.meta.env.VITE_SERVER_URL
    ? import.meta.env.VITE_SERVER_URL
    : window.location.origin

export interface ApiRequestOptions extends RequestInit {
  headers?: Record<string, string>
}

function readEdits(body: unknown): ChapterEdit[] {
  if (!body || typeof body !== "object" || !("edits" in body)) {
    return []
  }
  const value = body.edits
  if (!Array.isArray(value)) {
    return []
  }
  const edits: ChapterEdit[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue
    }
    const row = item as Record<string, unknown>
    if (
      typeof row.chapterId !== "string" ||
      typeof row.content !== "string" ||
      typeof row.updatedAt !== "string"
    ) {
      continue
    }
    edits.push({ chapterId: row.chapterId, content: row.content, updatedAt: row.updatedAt })
  }
  return edits
}

/**
 * Error thrown for non-2xx API responses, carrying the HTTP status
 * and the server-provided error code (when present) for callers
 * that need to branch on specific failures.
 */
export class ApiError extends Error {
  code: string | null
  edits: ChapterEdit[]
  status: number

  constructor(
    message: string,
    status: number,
    code: string | null = null,
    edits: ChapterEdit[] = []
  ) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.edits = edits
  }
}

/**
 * Base API call function with authentication
 */
export async function apiCall(endpoint: string, options: ApiRequestOptions = {}) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: "include", // Include auth cookies
    ...options,
  })

  if (!response.ok) {
    let errorMessage = `API Error: ${response.status} - ${response.statusText}`
    let errorCode: string | null = null
    let edits: ChapterEdit[] = []
    try {
      const errorBody = await response.json()
      if (errorBody.error) {
        errorMessage = errorBody.error
      } else if (errorBody.message) {
        errorMessage += ` - ${errorBody.message}`
      }
      if (typeof errorBody.code === "string") {
        errorCode = errorBody.code
      }
      edits = readEdits(errorBody)
    } catch {
      // Ignore JSON parse errors for error responses
    }
    throw new ApiError(errorMessage, response.status, errorCode, edits)
  }

  try {
    return await response.json()
  } catch (error) {
    throw new Error(`Invalid JSON response from ${endpoint}: ${error}`)
  }
}

/**
 * Generic API client interface for CRUD operations
 */
export interface ApiClient<T, CreateData = Partial<T>, UpdateData = Partial<T>> {
  create: (data: CreateData) => Promise<T | { success: boolean; id: string }>
  delete?: (id: string) => Promise<{ success: boolean }>
  get: (id: string) => Promise<T>
  list: () => Promise<T[]>
  update?: (id: string, data: UpdateData) => Promise<T | { success: boolean }>
}
