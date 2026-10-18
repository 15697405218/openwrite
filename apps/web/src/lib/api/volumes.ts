import { apiCall } from "./base"

export interface Volume {
  createdAt: string
  id: string
  order: number
  title: string
  updatedAt: string
  workId: string
}

export const volumesApi = {
  async list(projectId: string): Promise<Volume[]> {
    const response = await apiCall(`/api/projects/${projectId}/volumes`)
    return Array.isArray(response.volumes) ? response.volumes : []
  },

  async create(projectId: string, title: string): Promise<{ success: boolean; id: string }> {
    return (await apiCall(`/api/projects/${projectId}/volumes`, {
      method: "POST",
      body: JSON.stringify({ title }),
    })) as { success: boolean; id: string }
  },

  async update(projectId: string, volumeId: string, title: string): Promise<{ success: boolean }> {
    return (await apiCall(`/api/projects/${projectId}/volumes/${volumeId}`, {
      method: "PUT",
      body: JSON.stringify({ title }),
    })) as { success: boolean }
  },

  async delete(projectId: string, volumeId: string): Promise<{ success: boolean }> {
    return (await apiCall(`/api/projects/${projectId}/volumes/${volumeId}`, {
      method: "DELETE",
    })) as { success: boolean }
  },
}
