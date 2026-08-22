import { Agent, getAgentByName } from "agents"
import { eq } from "drizzle-orm"

import { createDb } from "./db"
import { guy } from "./db/schema"
import { asGuyHome, readMcpConfig } from "./home"
import {
  idleHookExists,
  lastMessageDangles,
  serializeMessage,
  writeAssistantReplies,
  writeIdleReplies,
  type SerializedMessage,
} from "./turn"
import type { ChatTool, ToolBridge } from "./reply"

type WakePayload = {
  userName: string
  attempt: number
}

export class GuyAgent extends Agent<Env, { userName: string }> {
  initialState = { userName: "" }

  async turn(payload: { userName: string }): Promise<SerializedMessage[]> {
    this.setState({ userName: payload.userName })
    const row = await this.loadGuy()
    if (!row) {
      return []
    }
    await this.syncMcp(row)
    const extra = this.mcpBridge()
    const inserted = await writeAssistantReplies(
      this.env,
      payload.userName,
      row,
      extra
    )
    await this.queueWake(payload.userName, 1)
    return inserted.map(serializeMessage)
  }

  async wake(payload: WakePayload) {
    const row = await this.loadGuy()
    if (!row) {
      return
    }
    await this.syncMcp(row)
    const extra = this.mcpBridge()
    const dangling = await lastMessageDangles(this.env, row.id)
    if (dangling) {
      await writeAssistantReplies(this.env, payload.userName, row, extra)
      if (
        payload.attempt < 2 &&
        (await lastMessageDangles(this.env, row.id))
      ) {
        await this.queueWake(payload.userName, payload.attempt + 1)
      }
      return
    }
    if (await idleHookExists(this.env, row)) {
      await writeIdleReplies(this.env, payload.userName, row, extra)
    }
  }

  private async queueWake(userName: string, attempt: number) {
    const row = await this.loadGuy()
    if (!row) {
      return
    }
    const dangling = await lastMessageDangles(this.env, row.id)
    const idle = await idleHookExists(this.env, row)
    if (!dangling && !idle) {
      return
    }
    await this.schedule(
      45,
      "wake",
      { userName, attempt } satisfies WakePayload,
      { idempotent: true }
    )
  }

  private async loadGuy() {
    const db = createDb(this.env.DB)
    const [row] = await db
      .select()
      .from(guy)
      .where(eq(guy.id, this.name))
      .limit(1)
    return row ?? null
  }

  private async syncMcp(row: typeof guy.$inferSelect) {
    try {
      const config = await readMcpConfig(this.env.BUCKET, asGuyHome(row))
      const connected = new Set(
        Object.values(this.getMcpServers().servers).map((server) => server.name)
      )
      for (const server of config.servers) {
        if (!server.url || connected.has(server.name)) {
          continue
        }
        await this.addMcpServer(server.name, server.url)
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "guy_mcp_sync_failed",
          error: error instanceof Error ? error.message : "unknown",
        })
      )
    }
  }

  private mcpBridge(): ToolBridge | undefined {
    try {
      const aiTools = this.mcp.getAITools()
      const names = Object.keys(aiTools)
      if (names.length === 0) {
        return undefined
      }
      const tools: ChatTool[] = names.map((name) => ({
        type: "function",
        function: {
          name,
          description: aiTools[name]?.description || name,
          parameters: {
            type: "object",
            additionalProperties: true,
            properties: {},
          },
        },
      }))
      return {
        tools,
        run: async (name, args) => {
          const tool = aiTools[name]
          if (!tool) {
            return null
          }
          const result = await tool.execute(args)
          return JSON.stringify(result ?? { ok: true })
        },
      }
    } catch {
      return undefined
    }
  }
}

export async function runGuyTurn(
  env: Env,
  userName: string,
  row: typeof guy.$inferSelect
): Promise<SerializedMessage[]> {
  const agent = await getAgentByName<Env, GuyAgent>(env.GuyAgent, row.id)
  return agent.turn({ userName })
}
