import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { betterAuth } from "better-auth/minimal"
import { magicLink } from "better-auth/plugins/magic-link"

import { createDb, schema } from "./db"
import { sendMagicLinkEmail } from "./email"

export function createAuth(env: Env, request: Request) {
  const origin = new URL(request.url).origin

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
        sendMagicLink: async ({ email, url }) => {
          await sendMagicLinkEmail(env, email, url)
        },
      }),
    ],
  })
}
