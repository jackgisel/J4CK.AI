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

## Mac CLI

`apps/cli` is a `j4ck` command that runs on your Mac. It signs in through the site, maps a local folder to a guy's `files/` cabinet, and keeps both sides in sync.

```bash
bun install
bun run --filter j4ck-cli compile    # writes apps/cli/dist/j4ck
# copy that binary onto your PATH, then:

j4ck login
j4ck guys
j4ck link <guy-name-or-id> ~/Documents/j4ck
j4ck sync
j4ck watch
j4ck service install                 # LaunchAgent so watch starts at login
```

Without compiling, from the repo:

```bash
bun run --filter j4ck-cli j4ck -- login
```

Approve the Mac at `/cli`. Tokens live in `~/.config/j4ck/config.json`. Sync state lives next to that, not inside the folder you linked. `--keep` skips deletions. Default `sync` / `watch` mirrors deletes both ways.

## Auth

`BETTER_AUTH_SECRET` lives in `apps/web/wrangler.jsonc`. Locally, magic links are simulated: the Worker logs the URL and writes the message to a file. After deploy, `env.EMAIL.send()` delivers through Cloudflare Email Service from `noreply@j4ck.ai`.

Onboard `j4ck.ai` in the Cloudflare dashboard under Email Service and add the SPF/DKIM records before production mail will send.

```bash
cd apps/web
bun run db:migrate:remote
```
