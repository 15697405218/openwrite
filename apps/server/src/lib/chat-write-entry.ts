import { and, desc, eq, or } from "drizzle-orm"
import { db } from "../db"
import {
  character,
  chatToolReceipt,
  location,
  lore,
  note,
  outlineNode,
  plotPoint,
  work,
} from "../db/schema"
import {
  isWriteToolName,
  type WriteProposal,
  type WriteTarget,
  type WriteToolName,
} from "./chat-approval"

const MAX_WRITE_CHARS = 20_000
const PREVIEW_CHARS = 2000

interface TextDoc {
  id: string
  text: string
  title: string
}

function replacePlain(
  text: string,
  find: string,
  replacement: string
): { text: string } | { error: string } {
  const needle = find.trim()
  if (needle.length === 0) {
    return { error: "find is empty" }
  }
  const first = text.indexOf(needle)
  if (first < 0) {
    return { error: "phrase not found" }
  }
  if (text.indexOf(needle, first + needle.length) >= 0) {
    return { error: "phrase matches more than once" }
  }
  return { text: `${text.slice(0, first)}${replacement}${text.slice(first + needle.length)}` }
}

export function appendPlain(base: string, text: string): string {
  const addition = text.trim()
  if (addition.length === 0) {
    return base
  }
  if (base.trim().length === 0) {
    return addition
  }
  return `${base.trimEnd()}\n\n${addition}`
}

function readArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {}
    }
    return parsed as Record<string, unknown>
  } catch {
    return {}
  }
}

function argString(args: Record<string, unknown>, key: string): string | null {
  const value = args[key]
  if (typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function entryKind(value: string | null): Exclude<WriteTarget, "chapter" | "outline"> | null {
  if (
    value === "character" ||
    value === "location" ||
    value === "lore" ||
    value === "note" ||
    value === "plot"
  ) {
    return value
  }
  return null
}

function authorText(description: string | null, summary: string | null): string {
  const full = description?.trim() ?? ""
  if (full.length > 0) {
    return full
  }
  return summary?.trim() ?? ""
}

async function loadOutline(projectId: string): Promise<TextDoc | null> {
  const row = await db
    .select({ id: outlineNode.id, body: outlineNode.body })
    .from(outlineNode)
    .where(eq(outlineNode.projectId, projectId))
    .get()
  if (!row) {
    return null
  }
  return { id: row.id, title: "Outline", text: row.body ?? "" }
}

async function ensureOutline(projectId: string): Promise<TextDoc> {
  const existing = await loadOutline(projectId)
  if (existing) {
    return existing
  }
  const now = new Date()
  const id = crypto.randomUUID()
  try {
    await db.insert(outlineNode).values({
      id,
      projectId,
      body: "",
      createdAt: now,
      updatedAt: now,
    })
  } catch {
    const again = await loadOutline(projectId)
    if (again) {
      return again
    }
    throw new Error("Failed to create the outline")
  }
  return { id, title: "Outline", text: "" }
}

async function loadNamed(
  table: typeof character | typeof location | typeof lore,
  projectId: string,
  id: string
): Promise<TextDoc | null> {
  const row = await db
    .select({
      id: table.id,
      name: table.name,
      description: table.description,
      summary: table.summary,
    })
    .from(table)
    .leftJoin(work, eq(table.workId, work.id))
    .where(and(eq(table.id, id), or(eq(table.projectId, projectId), eq(work.projectId, projectId))))
    .get()
  if (!row) {
    return null
  }
  return { id: row.id, title: row.name, text: authorText(row.description, row.summary) }
}

async function loadPlot(projectId: string, id: string): Promise<TextDoc | null> {
  const row = await db
    .select({
      id: plotPoint.id,
      title: plotPoint.title,
      description: plotPoint.description,
      summary: plotPoint.summary,
    })
    .from(plotPoint)
    .where(and(eq(plotPoint.id, id), eq(plotPoint.projectId, projectId)))
    .get()
  if (!row) {
    return null
  }
  return { id: row.id, title: row.title, text: authorText(row.description, row.summary) }
}

async function loadNote(projectId: string, id: string): Promise<TextDoc | null> {
  const row = await db
    .select({ id: note.id, title: note.title, body: note.body })
    .from(note)
    .where(and(eq(note.id, id), eq(note.projectId, projectId)))
    .get()
  if (!row) {
    return null
  }
  return { id: row.id, title: row.title, text: row.body ?? "" }
}

async function loadWritable(
  projectId: string,
  kind: WriteTarget,
  id: string | null
): Promise<TextDoc | null> {
  if (kind === "outline") {
    return await ensureOutline(projectId)
  }
  if (kind === "chapter" || !id) {
    return null
  }
  return await loadEntry(projectId, kind, id)
}

async function loadEntry(
  projectId: string,
  kind: Exclude<WriteTarget, "chapter" | "outline">,
  id: string
): Promise<TextDoc | null> {
  if (kind === "character") {
    return await loadNamed(character, projectId, id)
  }
  if (kind === "location") {
    return await loadNamed(location, projectId, id)
  }
  if (kind === "lore") {
    return await loadNamed(lore, projectId, id)
  }
  if (kind === "plot") {
    return await loadPlot(projectId, id)
  }
  return await loadNote(projectId, id)
}

function proposal(options: {
  action: WriteProposal["action"]
  arguments: string
  doc: TextDoc
  find: string
  name: WriteToolName
  preview: string
  target: WriteTarget
  toolId: string
}): { proposal: WriteProposal } {
  return {
    proposal: {
      action: options.action,
      arguments: options.arguments,
      chapterId: options.doc.id,
      chapterTitle: options.doc.title,
      find: options.find,
      id: options.toolId,
      name: options.name,
      preview: options.preview,
      target: options.target,
    },
  }
}

function describeChange(
  name: WriteToolName,
  args: Record<string, unknown>,
  doc: TextDoc,
  target: WriteTarget,
  toolId: string,
  raw: string
): { content: string } | { proposal: WriteProposal } {
  if (name === "append_to_outline" || name === "append_to_entry") {
    const text = argString(args, "text")?.slice(0, MAX_WRITE_CHARS) ?? ""
    if (text.length === 0) {
      return { content: JSON.stringify({ error: "missing text" }) }
    }
    return proposal({
      action: "append",
      arguments: raw,
      doc,
      find: "",
      name,
      preview: text.slice(0, PREVIEW_CHARS),
      target,
      toolId,
    })
  }
  const find = argString(args, "find") ?? ""
  if (find.length === 0) {
    return { content: JSON.stringify({ error: "find is empty" }) }
  }
  const replacement = (typeof args.replace === "string" ? args.replace : "").slice(
    0,
    MAX_WRITE_CHARS
  )
  const replaced = replacePlain(doc.text, find, replacement)
  if ("error" in replaced) {
    return { content: JSON.stringify({ error: replaced.error }) }
  }
  return proposal({
    action: "replace",
    arguments: raw,
    doc,
    find: find.slice(0, PREVIEW_CHARS),
    name,
    preview: replacement.slice(0, PREVIEW_CHARS),
    target,
    toolId,
  })
}

async function describeEntryLife(options: {
  arguments: string
  id: string
  name: WriteToolName
  projectId: string
}): Promise<{ content: string } | { proposal: WriteProposal }> {
  const args = readArgs(options.arguments)
  const kind = entryKind(argString(args, "kind"))
  if (!kind) {
    return { content: JSON.stringify({ error: "missing kind" }) }
  }
  if (options.name === "create_entry") {
    const title = argString(args, "name")
    if (!title) {
      return { content: JSON.stringify({ error: "missing name" }) }
    }
    const text = (typeof args.text === "string" ? args.text : "").slice(0, MAX_WRITE_CHARS)
    return proposal({
      action: "create",
      arguments: options.arguments,
      doc: { id: "", title, text },
      find: "",
      name: options.name,
      preview: text.slice(0, PREVIEW_CHARS),
      target: kind,
      toolId: options.id,
    })
  }
  const id = argString(args, "id")
  if (!id) {
    return { content: JSON.stringify({ error: "missing id" }) }
  }
  const doc = await loadEntry(options.projectId, kind, id)
  if (!doc) {
    return { content: JSON.stringify({ error: "not_found" }) }
  }
  return proposal({
    action: "delete",
    arguments: options.arguments,
    doc,
    find: "",
    name: options.name,
    preview: doc.text.slice(0, PREVIEW_CHARS),
    target: kind,
    toolId: options.id,
  })
}

export async function describeEntryWrite(options: {
  arguments: string
  id: string
  name: string
  projectId: string
}): Promise<{ content: string } | { proposal: WriteProposal } | null> {
  const name = options.name
  if (!isWriteToolName(name)) {
    return null
  }
  if (name === "create_entry" || name === "delete_entry") {
    return await describeEntryLife({
      arguments: options.arguments,
      id: options.id,
      name,
      projectId: options.projectId,
    })
  }
  const outlineWrite = name === "append_to_outline" || name === "replace_in_outline"
  const entryWrite = name === "append_to_entry" || name === "replace_in_entry"
  if (!(outlineWrite || entryWrite)) {
    return null
  }
  const args = readArgs(options.arguments)
  if (outlineWrite) {
    let doc: TextDoc | null = null
    try {
      doc = await ensureOutline(options.projectId)
    } catch {
      doc = null
    }
    if (!doc) {
      return { content: JSON.stringify({ error: "not_found" }) }
    }
    return describeChange(name, args, doc, "outline", options.id, options.arguments)
  }
  const kind = entryKind(argString(args, "kind"))
  const id = argString(args, "id")
  if (!(kind && id)) {
    return { content: JSON.stringify({ error: "missing kind or id" }) }
  }
  const doc = await loadEntry(options.projectId, kind, id)
  if (!doc) {
    return { content: JSON.stringify({ error: "not_found" }) }
  }
  return describeChange(name, args, doc, kind, options.id, options.arguments)
}

async function remembered(receiptId: string | undefined): Promise<string | null> {
  if (!receiptId) {
    return null
  }
  const existing = await db
    .select({ result: chatToolReceipt.result })
    .from(chatToolReceipt)
    .where(eq(chatToolReceipt.id, receiptId))
    .get()
  return existing?.result ?? null
}

async function saveText(target: WriteTarget, id: string, text: string) {
  const now = new Date()
  if (target === "outline") {
    await db.update(outlineNode).set({ body: text, updatedAt: now }).where(eq(outlineNode.id, id))
    return
  }
  if (target === "note") {
    await db.update(note).set({ body: text, updatedAt: now }).where(eq(note.id, id))
    return
  }
  if (target === "character") {
    await db
      .update(character)
      .set({ description: text, summary: null, updatedAt: now })
      .where(eq(character.id, id))
    return
  }
  if (target === "location") {
    await db
      .update(location)
      .set({ description: text, summary: null, updatedAt: now })
      .where(eq(location.id, id))
    return
  }
  if (target === "lore") {
    await db
      .update(lore)
      .set({ description: text, summary: null, updatedAt: now })
      .where(eq(lore.id, id))
    return
  }
  if (target === "plot") {
    await db
      .update(plotPoint)
      .set({ description: text, summary: null, updatedAt: now })
      .where(eq(plotPoint.id, id))
  }
}

async function saveReceipt(receipt: { id: string; result: string; threadId: string } | null) {
  if (!receipt) {
    return
  }
  await db.insert(chatToolReceipt).values({
    id: receipt.id,
    threadId: receipt.threadId,
    result: receipt.result,
  })
}

function nextText(
  name: string,
  args: Record<string, unknown>,
  current: string
): string | { error: string } {
  if (name === "append_to_outline" || name === "append_to_entry") {
    const text = argString(args, "text")?.slice(0, MAX_WRITE_CHARS) ?? ""
    if (text.length === 0) {
      return { error: "missing text" }
    }
    return appendPlain(current, text)
  }
  const find = argString(args, "find") ?? ""
  const replacement = (typeof args.replace === "string" ? args.replace : "").slice(
    0,
    MAX_WRITE_CHARS
  )
  const replaced = replacePlain(current, find, replacement)
  if ("error" in replaced) {
    return { error: replaced.error }
  }
  return replaced.text
}

async function nextPlotOrder(projectId: string): Promise<number> {
  const latest = await db
    .select({ order: plotPoint.order })
    .from(plotPoint)
    .where(eq(plotPoint.projectId, projectId))
    .orderBy(desc(plotPoint.order))
    .limit(1)
    .get()
  return (latest?.order ?? 0) + 1
}

async function insertEntry(
  projectId: string,
  kind: Exclude<WriteTarget, "chapter" | "outline">,
  title: string,
  text: string
): Promise<string> {
  const id = crypto.randomUUID()
  const now = new Date()
  const description = text.trim()
  if (kind === "character") {
    await db.insert(character).values({
      id,
      name: title,
      description,
      projectId,
      workId: null,
      createdAt: now,
      updatedAt: now,
    })
    return id
  }
  if (kind === "location") {
    await db.insert(location).values({
      id,
      name: title,
      description,
      projectId,
      createdAt: now,
      updatedAt: now,
    })
    return id
  }
  if (kind === "lore") {
    await db.insert(lore).values({
      id,
      name: title,
      description,
      projectId,
      createdAt: now,
      updatedAt: now,
    })
    return id
  }
  if (kind === "note") {
    await db.insert(note).values({
      id,
      projectId,
      title,
      body: description,
      createdAt: now,
      updatedAt: now,
    })
    return id
  }
  await db.insert(plotPoint).values({
    id,
    title,
    description,
    order: await nextPlotOrder(projectId),
    projectId,
    createdAt: now,
    updatedAt: now,
  })
  return id
}

async function removeEntry(
  kind: Exclude<WriteTarget, "chapter" | "outline">,
  id: string
): Promise<void> {
  if (kind === "character") {
    await db.delete(character).where(eq(character.id, id))
    return
  }
  if (kind === "location") {
    await db.delete(location).where(eq(location.id, id))
    return
  }
  if (kind === "lore") {
    await db.delete(lore).where(eq(lore.id, id))
    return
  }
  if (kind === "note") {
    await db.delete(note).where(eq(note.id, id))
    return
  }
  await db.delete(plotPoint).where(eq(plotPoint.id, id))
}

async function runEntryLife(options: {
  arguments: string
  name: "create_entry" | "delete_entry"
  projectId: string
  receiptId?: string
  threadId?: string
}): Promise<string> {
  const prior = await remembered(options.receiptId)
  if (prior) {
    return prior
  }
  const args = readArgs(options.arguments)
  const kind = entryKind(argString(args, "kind"))
  if (!kind) {
    return JSON.stringify({ error: "missing kind" })
  }
  if (options.name === "create_entry") {
    const title = argString(args, "name")
    if (!title) {
      return JSON.stringify({ error: "missing name" })
    }
    const text = typeof args.text === "string" ? args.text.slice(0, MAX_WRITE_CHARS) : ""
    const id = await insertEntry(options.projectId, kind, title, text)
    const result = JSON.stringify({ id, title, kind, created: true })
    await saveReceipt(
      options.receiptId && options.threadId
        ? { id: options.receiptId, threadId: options.threadId, result }
        : null
    )
    return result
  }
  const id = argString(args, "id")
  if (!id) {
    return JSON.stringify({ error: "missing id" })
  }
  const doc = await loadEntry(options.projectId, kind, id)
  if (!doc) {
    return JSON.stringify({ error: "not_found" })
  }
  await removeEntry(kind, doc.id)
  const result = JSON.stringify({ id: doc.id, title: doc.title, kind, deleted: true })
  await saveReceipt(
    options.receiptId && options.threadId
      ? { id: options.receiptId, threadId: options.threadId, result }
      : null
  )
  return result
}

export async function runEntryWrite(options: {
  arguments: string
  name: string
  projectId: string
  receiptId?: string
  threadId?: string
}): Promise<string | null> {
  if (options.name === "create_entry" || options.name === "delete_entry") {
    return await runEntryLife({
      arguments: options.arguments,
      name: options.name,
      projectId: options.projectId,
      receiptId: options.receiptId,
      threadId: options.threadId,
    })
  }
  const outlineWrite = options.name === "append_to_outline" || options.name === "replace_in_outline"
  const entryWrite = options.name === "append_to_entry" || options.name === "replace_in_entry"
  if (!(outlineWrite || entryWrite)) {
    return null
  }
  const prior = await remembered(options.receiptId)
  if (prior) {
    return prior
  }
  const args = readArgs(options.arguments)
  const kind = outlineWrite ? "outline" : entryKind(argString(args, "kind"))
  const entryId = outlineWrite ? null : argString(args, "id")
  if (!(kind && (outlineWrite || entryId))) {
    return JSON.stringify({ error: "missing kind or id" })
  }
  const doc = await loadWritable(options.projectId, kind, entryId)
  if (!doc) {
    return JSON.stringify({ error: "not_found" })
  }
  const updated = nextText(options.name, args, doc.text)
  if (typeof updated !== "string") {
    return JSON.stringify({ error: updated.error })
  }
  const appended = options.name === "append_to_outline" || options.name === "append_to_entry"
  const result = JSON.stringify({
    id: doc.id,
    title: doc.title,
    kind,
    appended,
    replaced: !appended,
  })
  const receipt =
    options.receiptId && options.threadId
      ? { id: options.receiptId, threadId: options.threadId, result }
      : null
  await saveText(kind, doc.id, updated)
  await saveReceipt(receipt)
  return result
}
