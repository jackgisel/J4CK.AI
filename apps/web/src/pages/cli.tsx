import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  approveDevice,
  createCliToken,
  deleteCliToken,
  getDevice,
  listCliTokens,
  type CliTokenRow,
  type DeviceStatus,
} from "@/lib/cli"

export function CliPage() {
  const [searchParams] = useSearchParams()
  const deviceId = searchParams.get("device")?.trim() || null

  return (
    <div className="flex flex-col gap-8">
      {deviceId ? <ApproveCard deviceId={deviceId} /> : null}
      <InstallCard />
      <TokensCard />
    </div>
  )
}

function ApproveCard({ deviceId }: { deviceId: string }) {
  const [status, setStatus] = useState<DeviceStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    getDevice(deviceId)
      .then((next) => {
        if (!cancelled) {
          setStatus(next)
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not load")
        }
      })
    return () => {
      cancelled = true
    }
  }, [deviceId])

  async function approve() {
    setBusy(true)
    setError(null)
    try {
      const next = await approveDevice(deviceId)
      setStatus({ status: next.status, hostname: next.hostname })
      setBusy(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not approve")
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Link this Mac</CardTitle>
        <CardDescription>
          The j4ck CLI on your computer is waiting. Approve it to keep a local
          folder in sync with a guy's cabinet.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {status?.status === "expired" ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            That login expired. Run{" "}
            <code className="font-mono">j4ck login</code> on the Mac and click
            the new link.
          </p>
        ) : null}
        {status?.status === "approved" ? (
          <p className="text-sm leading-relaxed">
            Linked{status.hostname ? ` to ${status.hostname}` : ""}. Back in the
            terminal, the CLI should finish on its own.
          </p>
        ) : null}
        {status?.status === "pending" ? (
          <>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {status.hostname
                ? `Request from ${status.hostname}.`
                : "A Mac is asking to sign in."}{" "}
              This creates a token stored on that machine. You can revoke it
              later on this page.
            </p>
            <div>
              <Button type="button" disabled={busy} onClick={approve}>
                {busy ? "Linking" : "Approve this Mac"}
              </Button>
            </div>
          </>
        ) : null}
        {!status && !error ? (
          <p className="text-sm text-muted-foreground">
            Checking that request…
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function InstallCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mac CLI</CardTitle>
        <CardDescription>
          Runs on your Mac. Maps a local folder to a guy's files/ cabinet and
          keeps both sides in sync.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm leading-relaxed">
        <p>From the j4ck.ai repo, with Bun installed:</p>
        <pre className="overflow-x-auto bg-muted px-4 py-3 font-mono text-xs">
          {`bun install
bun run --filter j4ck-cli compile
# then copy apps/cli/dist/j4ck somewhere on your PATH`}
        </pre>
        <p>Or run it from the repo without compiling:</p>
        <pre className="overflow-x-auto bg-muted px-4 py-3 font-mono text-xs">
          {`bun run --filter j4ck-cli j4ck -- login
bun run --filter j4ck-cli j4ck -- guys
bun run --filter j4ck-cli j4ck -- link <guy> ~/Documents/j4ck
bun run --filter j4ck-cli j4ck -- sync
bun run --filter j4ck-cli j4ck -- watch
bun run --filter j4ck-cli j4ck -- service install`}
        </pre>
        <p className="text-muted-foreground">
          <code className="font-mono">watch</code> stays running.{" "}
          <code className="font-mono">service install</code> writes a
          LaunchAgent so it comes back after reboot.
        </p>
      </CardContent>
    </Card>
  )
}

function TokensCard() {
  const [tokens, setTokens] = useState<CliTokenRow[] | null>(null)
  const [name, setName] = useState("Mac")
  const [secret, setSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const rows = await listCliTokens()
    setTokens(rows)
  }

  useEffect(() => {
    let cancelled = false
    listCliTokens()
      .then((rows) => {
        if (!cancelled) {
          setTokens(rows)
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not load")
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function create() {
    setBusy(true)
    setError(null)
    setSecret(null)
    try {
      const created = await createCliToken(name.trim() || "Mac")
      setSecret(created.token)
      await refresh()
      setBusy(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create")
      setBusy(false)
    }
  }

  async function revoke(id: string) {
    if (!window.confirm("Revoke this Mac token?")) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      await deleteCliToken(id)
      if (secret) {
        setSecret(null)
      }
      await refresh()
      setBusy(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not revoke")
      setBusy(false)
    }
  }

  const empty = useMemo(() => tokens !== null && tokens.length === 0, [tokens])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tokens</CardTitle>
        <CardDescription>
          Each linked Mac holds one token. Create one here if you want to paste
          it into the CLI instead of using the approve link.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {secret ? (
          <p className="text-sm leading-relaxed">
            Copy this now. It is not shown again.
            <code className="mt-2 block overflow-x-auto bg-muted px-3 py-2 font-mono text-xs">
              {secret}
            </code>
            Then run <code className="font-mono">j4ck login --token …</code>
          </p>
        ) : null}
        <ul className="flex flex-col border-y border-border">
          {(tokens ?? []).map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 border-b border-border last:border-b-0"
            >
              <div className="min-w-0 py-3">
                <p className="text-sm">{row.name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {row.prefix}…
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={busy}
                onClick={() => revoke(row.id)}
              >
                Revoke
              </Button>
            </li>
          ))}
          {empty ? (
            <li className="py-3 text-sm text-muted-foreground">
              No Macs linked yet.
            </li>
          ) : null}
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Label htmlFor="token-name">New token</Label>
            <Input
              id="token-name"
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={create}
          >
            Create
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
