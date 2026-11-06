import path from "node:path"
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin"
import { defineConfig } from "vitest/config"

export default defineConfig(async () => {
  const migrations = await readD1Migrations(
    path.join(import.meta.dirname, "drizzle")
  )

  return {
    plugins: [
      cloudflareTest({
        main: "./worker/index.ts",
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
    ],
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "./src") },
    },
    test: {
      include: ["src/**/*.test.ts", "test/**/*.test.ts"],
      setupFiles: ["./test/setup.ts"],
    },
  }
})
