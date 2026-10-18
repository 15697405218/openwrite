import type { RunnableConfig } from "@langchain/core/runnables"
import {
  BaseCheckpointSaver,
  type Checkpoint,
  type CheckpointListOptions,
  type CheckpointMetadata,
  type CheckpointPendingWrite,
  type CheckpointTuple,
  compareWritesSortKeys,
  copyCheckpoint,
  type PendingWrite,
  WRITES_IDX_MAP,
  writesSortKey,
} from "@langchain/langgraph-checkpoint"
import { and, desc, eq } from "drizzle-orm"
import { db } from "../db"
import { langgraphCheckpoint, langgraphWrite } from "../db/schema"

type CheckpointRow = typeof langgraphCheckpoint.$inferSelect

function threadIdOf(config: RunnableConfig): string | undefined {
  const value = config.configurable?.thread_id
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function namespaceOf(config: RunnableConfig): string {
  const value = config.configurable?.checkpoint_ns
  return typeof value === "string" ? value : ""
}

function checkpointIdOf(config: RunnableConfig): string | undefined {
  const value = config.configurable?.checkpoint_id
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function asText(data: Uint8Array): string {
  return new TextDecoder().decode(data)
}

function writeIndex(channel: string, idx: number): number {
  const mapped = WRITES_IDX_MAP[channel]
  return mapped ?? idx
}

/**
 * Stores LangGraph checkpoints in D1 (and the test database) through Drizzle.
 * PostgresSaver needs a TCP `pg` pool, which hangs inside Workers.
 */
export class SqliteCheckpointer extends BaseCheckpointSaver {
  private async readJson<T>(stored: string): Promise<T> {
    return (await this.serde.loadsTyped("json", stored)) as T
  }

  private async dumpJson(value: unknown): Promise<string> {
    const [, bytes] = await this.serde.dumpsTyped(value)
    return asText(bytes)
  }

  private async pendingWrites(row: CheckpointRow): Promise<CheckpointPendingWrite[]> {
    const stored = await db
      .select()
      .from(langgraphWrite)
      .where(
        and(
          eq(langgraphWrite.threadId, row.threadId),
          eq(langgraphWrite.checkpointNs, row.checkpointNs),
          eq(langgraphWrite.checkpointId, row.checkpointId)
        )
      )
    const ordered = stored
      .map((item) => ({
        item,
        key: writesSortKey(item.taskPath, item.taskId, item.idx),
      }))
      .sort((left, right) => compareWritesSortKeys(left.key, right.key))
    const writes: CheckpointPendingWrite[] = []
    for (const { item } of ordered) {
      writes.push([item.taskId, item.channel, await this.readJson(item.value)])
    }
    return writes
  }

  private async tupleFor(row: CheckpointRow): Promise<CheckpointTuple> {
    const checkpoint = await this.readJson<Checkpoint>(row.checkpoint)
    const metadata = await this.readJson<CheckpointMetadata>(row.metadata)
    const pendingWrites = await this.pendingWrites(row)
    const config = {
      configurable: {
        thread_id: row.threadId,
        checkpoint_ns: row.checkpointNs,
        checkpoint_id: row.checkpointId,
      },
    }
    const tuple: CheckpointTuple = { config, checkpoint, metadata, pendingWrites }
    if (row.parentId) {
      tuple.parentConfig = {
        configurable: {
          thread_id: row.threadId,
          checkpoint_ns: row.checkpointNs,
          checkpoint_id: row.parentId,
        },
      }
    }
    return tuple
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId = threadIdOf(config)
    if (!threadId) {
      return
    }
    const checkpointNs = namespaceOf(config)
    const checkpointId = checkpointIdOf(config)
    const row = checkpointId
      ? await db
          .select()
          .from(langgraphCheckpoint)
          .where(
            and(
              eq(langgraphCheckpoint.threadId, threadId),
              eq(langgraphCheckpoint.checkpointNs, checkpointNs),
              eq(langgraphCheckpoint.checkpointId, checkpointId)
            )
          )
          .get()
      : await db
          .select()
          .from(langgraphCheckpoint)
          .where(
            and(
              eq(langgraphCheckpoint.threadId, threadId),
              eq(langgraphCheckpoint.checkpointNs, checkpointNs)
            )
          )
          .orderBy(desc(langgraphCheckpoint.checkpointId))
          .limit(1)
          .get()
    if (!row) {
      return
    }
    return await this.tupleFor(row)
  }

  async *list(
    config: RunnableConfig,
    options?: CheckpointListOptions
  ): AsyncGenerator<CheckpointTuple> {
    const threadId = threadIdOf(config)
    if (!threadId) {
      return
    }
    const checkpointNs = namespaceOf(config)
    const beforeId = options?.before ? checkpointIdOf(options.before) : undefined
    const rows = await db
      .select()
      .from(langgraphCheckpoint)
      .where(
        and(
          eq(langgraphCheckpoint.threadId, threadId),
          eq(langgraphCheckpoint.checkpointNs, checkpointNs)
        )
      )
      .orderBy(desc(langgraphCheckpoint.checkpointId))
    let remaining = options?.limit
    for (const row of rows) {
      if (beforeId && row.checkpointId >= beforeId) {
        continue
      }
      const tuple = await this.tupleFor(row)
      if (!metadataMatches(tuple.metadata, options?.filter)) {
        continue
      }
      if (remaining !== undefined) {
        if (remaining <= 0) {
          return
        }
        remaining -= 1
      }
      yield tuple
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata
  ): Promise<RunnableConfig> {
    const threadId = threadIdOf(config)
    if (!threadId) {
      throw new Error("A chat checkpoint needs a thread_id")
    }
    const checkpointNs = namespaceOf(config)
    const parentId = checkpointIdOf(config) ?? null
    await db
      .insert(langgraphCheckpoint)
      .values({
        threadId,
        checkpointNs,
        checkpointId: checkpoint.id,
        parentId,
        checkpoint: await this.dumpJson(copyCheckpoint(checkpoint)),
        metadata: await this.dumpJson(metadata),
      })
      .onConflictDoUpdate({
        target: [
          langgraphCheckpoint.threadId,
          langgraphCheckpoint.checkpointNs,
          langgraphCheckpoint.checkpointId,
        ],
        set: {
          parentId,
          checkpoint: await this.dumpJson(copyCheckpoint(checkpoint)),
          metadata: await this.dumpJson(metadata),
        },
      })
    return {
      configurable: {
        thread_id: threadId,
        checkpoint_ns: checkpointNs,
        checkpoint_id: checkpoint.id,
      },
    }
  }

  async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string,
    taskPath = ""
  ): Promise<void> {
    const threadId = threadIdOf(config)
    const checkpointId = checkpointIdOf(config)
    if (!(threadId && checkpointId)) {
      throw new Error("A chat checkpoint write needs a thread_id and checkpoint_id")
    }
    const checkpointNs = namespaceOf(config)
    let idx = 0
    for (const [channel, value] of writes) {
      const writeIdx = writeIndex(channel, idx)
      idx += 1
      if (writeIdx >= 0) {
        const existing = await db
          .select({ idx: langgraphWrite.idx })
          .from(langgraphWrite)
          .where(
            and(
              eq(langgraphWrite.threadId, threadId),
              eq(langgraphWrite.checkpointNs, checkpointNs),
              eq(langgraphWrite.checkpointId, checkpointId),
              eq(langgraphWrite.taskId, taskId),
              eq(langgraphWrite.idx, writeIdx)
            )
          )
          .get()
        if (existing) {
          continue
        }
      }
      await db
        .insert(langgraphWrite)
        .values({
          threadId,
          checkpointNs,
          checkpointId,
          taskId,
          idx: writeIdx,
          channel,
          value: await this.dumpJson(value),
          taskPath,
        })
        .onConflictDoUpdate({
          target: [
            langgraphWrite.threadId,
            langgraphWrite.checkpointNs,
            langgraphWrite.checkpointId,
            langgraphWrite.taskId,
            langgraphWrite.idx,
          ],
          set: {
            channel,
            value: await this.dumpJson(value),
            taskPath,
          },
        })
    }
  }

  async deleteThread(threadId: string): Promise<void> {
    await db.delete(langgraphWrite).where(eq(langgraphWrite.threadId, threadId))
    await db.delete(langgraphCheckpoint).where(eq(langgraphCheckpoint.threadId, threadId))
  }
}

function metadataMatches(
  metadata: CheckpointMetadata | undefined,
  filter: Record<string, unknown> | undefined
): boolean {
  if (!filter) {
    return true
  }
  if (!metadata) {
    return false
  }
  const record = metadata as Record<string, unknown>
  for (const [key, value] of Object.entries(filter)) {
    if (record[key] !== value) {
      return false
    }
  }
  return true
}

export const chatCheckpointer = new SqliteCheckpointer()
