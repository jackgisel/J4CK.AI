import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { betterAuth } from "better-auth/minimal"
import { magicLink } from "better-auth/plugins/magic-link"

import { eq } from "drizzle-orm"

import { createDb, schema } from "./db"
import { sendMagicLinkEmail } from "./email"

export function createAuth(env: Env, request: Request) {
  const origin = new URL(request.url).origin
  const signUpOpen = env.ALLOW_SIGN_UP === "true"

  return betterAuth({
    appName: "j4ck.ai",
    secret: env.BETTER_AUTH_SECRET,
    baseURL: origin,
    trustedOrigins: [origin],
    database: drizzleAdapter(createDb(env.DB), {
      provider: "sqlite",
      schema,
      transaction: false,
    }),
    plugins: [
      magicLink({
        expiresIn: 60 * 10,
        storeToken: "hashed",
        disableSignUp: !signUpOpen,
        // disableSignUp only blocks the verify step, so a stranger's address
        // would still get mail. Skipping quietly keeps the response the same
        // for known and unknown addresses.
        sendMagicLink: async ({ email, url }) => {
          if (signUpOpen || (await hasAccount(env, email))) {
            await sendMagicLinkEmail(env, email, url)
          }
        },
      }),
    ],
  })
}

async function hasAccount(env: Env, email: string) {
  const [row] = await createDb(env.DB)
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, email.toLowerCase()))
  return Boolean(row)
}
