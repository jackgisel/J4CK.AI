import { relations } from "drizzle-orm"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

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

export const guy = sqliteTable(
  "guy",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    backstory: text("backstory").notNull().default(""),
    avatarEyes: text("avatar_eyes").notNull().default("dots"),
    avatarFacialHair: text("avatar_facial_hair").notNull().default("none"),
    avatarHat: text("avatar_hat").notNull().default("none"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("guy_userId_idx").on(table.userId)]
)

export const message = sqliteTable(
  "message",
  {
    id: text("id").primaryKey(),
    guyId: text("guy_id")
      .notNull()
      .references(() => guy.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    body: text("body").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("message_guyId_createdAt_idx").on(table.guyId, table.createdAt),
  ]
)

export const cliDevice = sqliteTable(
  "cli_device",
  {
    id: text("id").primaryKey(),
    hostname: text("hostname").notNull().default(""),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    token: text("token"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("cli_device_expiresAt_idx").on(table.expiresAt)]
)

export const cliToken = sqliteTable(
  "cli_token",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    prefix: text("prefix").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("cli_token_userId_idx").on(table.userId)]
)

export const pipeline = sqliteTable(
  "pipeline",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    graph: text("graph").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("pipeline_userId_idx").on(table.userId)]
)

export const pipelineRun = sqliteTable(
  "pipeline_run",
  {
    id: text("id").primaryKey(),
    pipelineId: text("pipeline_id")
      .notNull()
      .references(() => pipeline.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["running", "complete", "error"],
    }).notNull(),
    input: text("input").notNull(),
    workflowInstanceId: text("workflow_instance_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("pipeline_run_pipelineId_idx").on(table.pipelineId),
    index("pipeline_run_userId_idx").on(table.userId),
  ]
)

export const studioMessage = sqliteTable(
  "studio_message",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    model: text("model").notNull(),
    body: text("body").notNull().default(""),
    artifactKey: text("artifact_key"),
    contentType: text("content_type"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("studio_message_userId_createdAt_idx").on(
      table.userId,
      table.createdAt
    ),
  ]
)

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  guys: many(guy),
  cliDevices: many(cliDevice),
  cliTokens: many(cliToken),
  pipelines: many(pipeline),
  studioMessages: many(studioMessage),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))

export const guyRelations = relations(guy, ({ one, many }) => ({
  user: one(user, { fields: [guy.userId], references: [user.id] }),
  messages: many(message),
}))

export const messageRelations = relations(message, ({ one }) => ({
  guy: one(guy, { fields: [message.guyId], references: [guy.id] }),
}))

export const cliDeviceRelations = relations(cliDevice, ({ one }) => ({
  user: one(user, { fields: [cliDevice.userId], references: [user.id] }),
}))

export const cliTokenRelations = relations(cliToken, ({ one }) => ({
  user: one(user, { fields: [cliToken.userId], references: [user.id] }),
}))

export const pipelineRelations = relations(pipeline, ({ one, many }) => ({
  user: one(user, { fields: [pipeline.userId], references: [user.id] }),
  runs: many(pipelineRun),
}))

export const pipelineRunRelations = relations(pipelineRun, ({ one }) => ({
  pipeline: one(pipeline, {
    fields: [pipelineRun.pipelineId],
    references: [pipeline.id],
  }),
  user: one(user, { fields: [pipelineRun.userId], references: [user.id] }),
}))

export const studioMessageRelations = relations(studioMessage, ({ one }) => ({
  user: one(user, { fields: [studioMessage.userId], references: [user.id] }),
}))
