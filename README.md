# j4ck.ai

Bun workspaces with a Vite + shadcn site in `apps/web` and shared UI in `packages/ui`. The site deploys as a Cloudflare Worker with an R2 binding.

## Scripts

```bash
bun install
bun dev
bun run build
bun run deploy
```

Add UI from the repo root:

```bash
bunx --bun shadcn@latest add button -c apps/web
```

The Worker lives in `apps/web/worker`. After changing `wrangler.jsonc`, regenerate types:

```bash
bun run --filter web cf-typegen
```
