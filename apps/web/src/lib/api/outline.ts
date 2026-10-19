import { apiCall } from "./base"

export interface ProjectOutline {
  body: string
  id: string
}

export const outlineApi = {
  async get(projectId: string): Promise<ProjectOutline> {
    const response = await apiCall(`/api/projects/${projectId}/outline`)
    return {
      body: typeof response.body === "string" ? response.body : "",
      id: typeof response.id === "string" ? response.id : "",
    }
  },

  async save(projectId: string, body: string): Promise<{ success: boolean }> {
    return (await apiCall(`/api/projects/${projectId}/outline`, {
      method: "PUT",
      body: JSON.stringify({ body }),
    })) as { success: boolean }
  },
}
