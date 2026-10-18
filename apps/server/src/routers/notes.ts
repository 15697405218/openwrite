import { and, asc, eq } from "drizzle-orm"
import { type Context, Hono } from "hono"
import { db } from "../db"
import { note } from "../db/schema"
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

function toNoteResponse(row: {
  body: string | null
  createdAt: Date
  id: string
  projectId: string
  title: string
  updatedAt: Date
}) {
  return {
    id: row.id,
    name: row.title,
    description: row.body ?? "",
    projectId: row.projectId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

const notesRouter = new Hono<{ Bindings: Env; Variables: Variables }>()

notesRouter.get(
  "/projects/:projectId/notes",
  requireAuth,
  verifyProjectAccess,
  async (c: AppContext) => {
    const projectId = c.req.param("projectId")
    if (!projectId) {
      return c.json({ error: "Project ID is required" }, 400)
    }

    const rows = await db
      .select()
      .from(note)
      .where(eq(note.projectId, projectId))
      .orderBy(asc(note.createdAt))

    return c.json({ notes: rows.map((row) => toNoteResponse(row)) })
  }
)

notesRouter.post(
  "/projects/:projectId/notes",
  requireAuth,
  verifyProjectAccess,
  async (c: AppContext) => {
    const projectId = c.req.param("projectId")
    if (!projectId) {
      return c.json({ error: "Project ID is required" }, 400)
    }

    const body = await c.req.json()
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return c.json({ error: "Name is required" }, 400)
    }

    const id = crypto.randomUUID()
    const now = new Date()
    const description = typeof body.description === "string" ? body.description.trim() : ""

    await db.insert(note).values({
      id,
      projectId,
      title: body.name.trim(),
      body: description,
      createdAt: now,
      updatedAt: now,
    })

    return c.json({ success: true, id }, 201)
  }
)

notesRouter.put(
  "/projects/:projectId/notes/:noteId",
  requireAuth,
  verifyProjectAccess,
  async (c: AppContext) => {
    const projectId = c.req.param("projectId")
    const noteId = c.req.param("noteId")
    if (!(projectId && noteId)) {
      return c.json({ error: "Missing required parameters" }, 400)
    }

    const existing = await db
      .select({ id: note.id })
      .from(note)
      .where(and(eq(note.id, noteId), eq(note.projectId, projectId)))
      .get()
    if (!existing) {
      return c.json({ error: "Note not found" }, 404)
    }

    const body = await c.req.json()
    const updates: { body?: string; title?: string; updatedAt: Date } = { updatedAt: new Date() }
    if (typeof body.name === "string" && body.name.trim()) {
      updates.title = body.name.trim()
    }
    if (typeof body.description === "string") {
      updates.body = body.description
    }

    await db.update(note).set(updates).where(eq(note.id, noteId))
    return c.json({ success: true })
  }
)

notesRouter.delete(
  "/projects/:projectId/notes/:noteId",
  requireAuth,
  verifyProjectAccess,
  async (c: AppContext) => {
    const projectId = c.req.param("projectId")
    const noteId = c.req.param("noteId")
    if (!(projectId && noteId)) {
      return c.json({ error: "Missing required parameters" }, 400)
    }

    const existing = await db
      .select({ id: note.id })
      .from(note)
      .where(and(eq(note.id, noteId), eq(note.projectId, projectId)))
      .get()
    if (!existing) {
      return c.json({ error: "Note not found" }, 404)
    }

    await db.delete(note).where(eq(note.id, noteId))
    return c.json({ success: true })
  }
)

export { notesRouter }
