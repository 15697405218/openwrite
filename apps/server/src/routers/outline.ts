import { eq } from "drizzle-orm"
import { type Context, Hono } from "hono"
import { db } from "../db"
import { outlineNode } from "../db/schema"
import { requireAuth, verifyProjectAccess } from "../middleware/auth"

interface Env {
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  CORS_ORIGIN: string
}

interface Variables {
  activeOrganization: {
    id: string
    name: string
    slug: string
  } | null
  session: {
    id: string
    userId: string
  }
  user: {
    id: string
    email: string
    name: string
  }
}

type AppContext = Context<{ Bindings: Env; Variables: Variables }>

const outlineRouter = new Hono<{ Bindings: Env; Variables: Variables }>()

outlineRouter.get(
  "/projects/:projectId/outline",
  requireAuth,
  verifyProjectAccess,
  async (c: AppContext) => {
    const projectId = c.req.param("projectId")
    if (!projectId) {
      return c.json({ error: "Project ID is required" }, 400)
    }
    const outline = await ensureOutline(projectId)
    return c.json(outline)
  }
)

outlineRouter.put(
  "/projects/:projectId/outline",
  requireAuth,
  verifyProjectAccess,
  async (c: AppContext) => {
    const projectId = c.req.param("projectId")
    if (!projectId) {
      return c.json({ error: "Project ID is required" }, 400)
    }
    const body = await readJson(c)
    if (!body) {
      return c.json({ error: "Invalid JSON body" }, 400)
    }
    const outline = await ensureOutline(projectId)
    const text = typeof body.body === "string" ? body.body : outline.body
    await db
      .update(outlineNode)
      .set({ body: text, updatedAt: new Date() })
      .where(eq(outlineNode.id, outline.id))
    return c.json({ success: true })
  }
)

async function readJson(c: AppContext): Promise<Record<string, unknown> | null> {
  try {
    const body = await c.req.json()
    if (typeof body === "object" && body !== null && !Array.isArray(body)) {
      return body
    }
    return null
  } catch {
    return null
  }
}

async function ensureOutline(projectId: string): Promise<{ body: string; id: string }> {
  const existing = await readOutline(projectId)
  if (existing) {
    return existing
  }
  const now = new Date()
  try {
    await db.insert(outlineNode).values({
      id: crypto.randomUUID(),
      projectId,
      body: "",
      createdAt: now,
      updatedAt: now,
    })
  } catch {
    const again = await readOutline(projectId)
    if (again) {
      return again
    }
    throw new Error("Failed to create the outline")
  }
  const created = await readOutline(projectId)
  if (!created) {
    throw new Error("Failed to create the outline")
  }
  return created
}

async function readOutline(projectId: string): Promise<{ body: string; id: string } | undefined> {
  const row = await db
    .select({ id: outlineNode.id, body: outlineNode.body })
    .from(outlineNode)
    .where(eq(outlineNode.projectId, projectId))
    .get()
  if (!row) {
    return
  }
  return { id: row.id, body: row.body ?? "" }
}

export { outlineRouter }
