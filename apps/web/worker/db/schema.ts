import { relations } from "drizzle-orm"
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core"

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .default(false)
    .notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)]
)

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)]
)

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
)

export const task = sqliteTable(
  "task",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    done: integer("done", { mode: "boolean" }).default(false).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("task_userId_idx").on(table.userId)]
)

export const list = sqliteTable(
  "list",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    parentId: text("parent_id").references((): AnySQLiteColumn => list.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("list_userId_idx").on(table.userId),
    index("list_parentId_idx").on(table.parentId),
  ]
)

export const card = sqliteTable(
  "card",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    transcript: text("transcript").notNull(),
    status: text("status", {
      enum: ["idea", "researching", "approval", "approved", "running", "done"],
    })
      .notNull()
      .default("idea"),
    plan: text("plan"),
    estimate: text("estimate"),
    spentUsd: real("spent_usd").notNull().default(0),
    error: text("error"),
    approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("card_userId_idx").on(table.userId)]
)

export const run = sqliteTable(
  "run",
  {
    // Also the Workflow instance id, so a runaway can be found and terminated.
    id: text("id").primaryKey(),
    cardId: text("card_id")
      .notNull()
      .references(() => card.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    status: text("status", {
      enum: ["running", "finished", "capped", "turn_limit", "failed"],
    })
      .notNull()
      .default("running"),
    budgetUsd: real("budget_usd").notNull(),
    // What research predicted for this model, kept in case the card changes.
    estimateUsd: real("estimate_usd"),
    estimateInputTokens: integer("estimate_input_tokens"),
    estimateOutputTokens: integer("estimate_output_tokens"),
    stepCount: integer("step_count").notNull().default(0),
    stepsDone: integer("steps_done").notNull().default(0),
    // These totals are recomputed from run_turn, so saving twice is harmless.
    turns: integer("turns").notNull().default(0),
    retries: integer("retries").notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    cachedTokens: integer("cached_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    reasoningTokens: integer("reasoning_tokens").notNull().default(0),
    costUsd: real("cost_usd").notNull().default(0),
    searchUsd: real("search_usd").notNull().default(0),
    result: text("result"),
    error: text("error"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("run_cardId_idx").on(table.cardId),
    index("run_userId_idx").on(table.userId),
  ]
)

export const runTurn = sqliteTable(
  "run_turn",
  {
    // runId:step:turn, so a retried save lands on the same row.
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => run.id, { onDelete: "cascade" }),
    stepIndex: integer("step_index").notNull(),
    stepTitle: text("step_title").notNull(),
    turn: integer("turn").notNull(),
    provider: text("provider"),
    finishReason: text("finish_reason").notNull(),
    retries: integer("retries").notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    cachedTokens: integer("cached_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    reasoningTokens: integer("reasoning_tokens").notNull().default(0),
    // OpenRouter's count, which runs high: one billed search reported as 2.
    searches: integer("searches").notNull().default(0),
    costUsd: real("cost_usd").notNull().default(0),
    searchUsd: real("search_usd").notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    output: text("output").notNull(),
    citations: text("citations").notNull().default("[]"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("run_turn_runId_idx").on(table.runId)]
)

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  tasks: many(task),
  lists: many(list),
  cards: many(card),
  runs: many(run),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))

export const taskRelations = relations(task, ({ one }) => ({
  user: one(user, { fields: [task.userId], references: [user.id] }),
}))

export const listRelations = relations(list, ({ one, many }) => ({
  user: one(user, { fields: [list.userId], references: [user.id] }),
  parent: one(list, {
    fields: [list.parentId],
    references: [list.id],
    relationName: "children",
  }),
  children: many(list, { relationName: "children" }),
}))

export const cardRelations = relations(card, ({ one, many }) => ({
  user: one(user, { fields: [card.userId], references: [user.id] }),
  runs: many(run),
}))

export const runRelations = relations(run, ({ one, many }) => ({
  card: one(card, { fields: [run.cardId], references: [card.id] }),
  user: one(user, { fields: [run.userId], references: [user.id] }),
  turns: many(runTurn),
}))

export const runTurnRelations = relations(runTurn, ({ one }) => ({
  run: one(run, { fields: [runTurn.runId], references: [run.id] }),
}))
