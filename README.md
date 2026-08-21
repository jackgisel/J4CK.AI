# j4ck.ai

Bun workspaces with a Vite + shadcn site in `apps/web` and shared UI in `packages/ui`. The site deploys as a Cloudflare Worker. Auth is Better Auth magic links. Accounts live in D1 through Drizzle. Files live in R2. Sign-in mail goes out through Cloudflare Email Service.

## Scripts

```bash
bun install
bun dev
bun run build
bun run deploy
```

From `apps/web`:

```bash
bun run db:generate          # Drizzle SQL from the schema
bun run db:migrate:local     # apply to local D1
bun run db:migrate:remote    # apply to production D1
```

Add UI from the repo root:

```bash
bunx --bun shadcn@latest add button -c apps/web
```

The Worker lives in `apps/web/worker`. After changing `wrangler.jsonc`, regenerate types:

```bash
bun run --filter web cf-typegen
```

## Auth

`BETTER_AUTH_SECRET` lives in `apps/web/wrangler.jsonc`. Locally, magic links are simulated: the Worker logs the URL and writes the message to a file. After deploy, `env.EMAIL.send()` delivers through Cloudflare Email Service from `noreply@j4ck.ai`.

Onboard `j4ck.ai` in the Cloudflare dashboard under Email Service and add the SPF/DKIM records before production mail will send.

```bash
cd apps/web
bun run db:migrate:remote
```
