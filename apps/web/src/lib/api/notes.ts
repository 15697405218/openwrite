import { apiCall } from "./base"

export interface StoryNote {
  createdAt: string
  description: string
  id: string
  name: string
  projectId: string
  updatedAt: string
}

export interface StoryNoteInput {
  description?: string
  name: string
}

export const notesApi = {
  async list(projectId: string): Promise<StoryNote[]> {
    const response = await apiCall(`/api/projects/${projectId}/notes`)
    return Array.isArray(response.notes) ? response.notes : []
  },

  async create(projectId: string, data: StoryNoteInput): Promise<{ success: boolean; id: string }> {
    return (await apiCall(`/api/projects/${projectId}/notes`, {
      method: "POST",
      body: JSON.stringify(data),
    })) as { success: boolean; id: string }
  },

  async update(
    projectId: string,
    noteId: string,
    data: StoryNoteInput
  ): Promise<{ success: boolean }> {
    return (await apiCall(`/api/projects/${projectId}/notes/${noteId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })) as { success: boolean }
  },

  async delete(projectId: string, noteId: string): Promise<{ success: boolean }> {
    return (await apiCall(`/api/projects/${projectId}/notes/${noteId}`, {
      method: "DELETE",
    })) as { success: boolean }
  },
}
