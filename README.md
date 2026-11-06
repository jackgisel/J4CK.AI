# j4ck.ai

Bun workspaces with a Vite + shadcn site in `apps/web` and shared UI in `packages/ui`. The site deploys as a Cloudflare Worker. Auth is Better Auth magic links. Accounts live in D1 through Drizzle. Files live in R2. Sign-in mail goes out through Cloudflare Email Service.

## Scripts

```bash
bun install
bun dev
bun run build
bun run deploy
bun run lint                 # Biome, the same check CI runs
bun run format               # Biome, with fixes
bun run --filter web test    # Vitest inside the Workers runtime
```

Pull requests must pass lint, typecheck, tests and build. A merge to `main` runs the same checks, applies D1 migrations and deploys the Worker. The `CLOUDFLARE_API_TOKEN` repo secret needs Workers Scripts and D1 edit access.

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

## App

`/` is a public landing page with no link to sign in. `/login` still works by direct URL. Signed-in users land on `/board`. `/tasks` is a flat to-do list. `/lists` holds lists that nest to any depth. Deleting a list deletes everything under it.

## Board

`/board` turns a spoken note into a card. Whisper runs in a Web Worker through Transformers.js, so audio stays in the browser. Only the text you save reaches the Worker.

Moving a card from Idea to Researching starts `CardResearchWorkflow`. One agent writes a plan, a second estimates its tokens, and the Worker prices those tokens against live OpenRouter rates. The card then waits in Needs approval.

Approving starts `CardRunWorkflow`, which works through the plan with `deepseek/deepseek-v4-flash` and OpenRouter's web search, then writes up a result. Each model call is one Workflow step. A cut-off reply gets up to 3 turns.

The run stops before any call whose worst case could pass `RUN_BUDGET_USD` ($1). A run that stops early goes back to Approved with its notes, and spends nothing more until someone presses Run again.

`run` holds totals and `run_turn` holds every call, with provider, tokens, cached tokens, reasoning tokens, cost and duration. `search_usd` is the part of the cost that went to web search. Finished means every step ended. It does not mean the result was any good. The estimate does not include search fees yet.

The Worker needs `OPENROUTER_API_KEY`, set with `wrangler secret put` and in `.dev.vars` locally.

## Auth

Sign-up is closed, so magic links only reach existing accounts. Set `ALLOW_SIGN_UP` to `true` on the Worker to let a new person in, then remove it. Everything behind login can spend OpenRouter credits.

`BETTER_AUTH_SECRET` lives in `apps/web/wrangler.jsonc`. Locally, magic links are simulated: the Worker logs the URL and writes the message to a file. After deploy, `env.EMAIL.send()` delivers through Cloudflare Email Service from `noreply@j4ck.ai`.

Onboard `j4ck.ai` in the Cloudflare dashboard under Email Service and add the SPF/DKIM records before production mail will send.

```bash
cd apps/web
bun run db:migrate:remote
```
