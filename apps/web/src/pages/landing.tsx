import { useEffect, useState } from "react"
import { Link } from "react-router"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { authClient } from "@/lib/auth-client"

type Health = "checking" | "ok" | "down"

type ServiceStatus =
  { state: "checking" } | { state: "ok"; detail?: string } | { state: "down" }

export function LandingPage() {
  const { data: session, isPending } = authClient.useSession()
  const [health, setHealth] = useState<Health>("checking")
  const [db, setDb] = useState<Health>("checking")
  const [r2, setR2] = useState<ServiceStatus>({ state: "checking" })

  useEffect(() => {
    fetch("/api/health")
      .then((response) => {
        if (!response.ok) {
          throw new Error("health check failed")
        }
        return response.json() as Promise<{ ok: boolean; db: boolean }>
      })
      .then((data) => {
        setHealth(data.ok ? "ok" : "down")
        setDb(data.db ? "ok" : "down")
      })
      .catch(() => {
        setHealth("down")
        setDb("down")
      })

    fetch("/api/r2")
      .then((response) => {
        if (!response.ok) {
          throw new Error("r2 list failed")
        }
        return response.json() as Promise<{ objects: unknown[] }>
      })
      .then((data) => {
        setR2({
          state: "ok",
          detail: `${data.objects.length} object${data.objects.length === 1 ? "" : "s"}`,
        })
      })
      .catch(() => {
        setR2({ state: "down" })
      })
  }, [])

  return (
    <div className="flex flex-1 flex-col justify-center gap-10">
      <div className="flex max-w-xl flex-col gap-4">
        <Badge variant="secondary">Worker + D1</Badge>
        <h1 className="font-heading text-4xl font-semibold tracking-tight md:text-6xl">
          Jack Gisel
        </h1>
        <p className="max-w-md text-base leading-relaxed text-muted-foreground">
          A small site on Cloudflare. Sign in with a link sent to your email.
          Sessions live in D1. Files live in R2.
        </p>
        {isPending ? null : (
          <div>
            <Button render={<Link to={session ? "/dashboard" : "/login"} />}>
              {session ? "Open dashboard" : "Log in"}
            </Button>
          </div>
        )}
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Status</CardTitle>
          <CardDescription>
            Live reads from the Worker. Press D to flip the theme.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-4">
            <StatusRow label="API" value={health} />
            <StatusRow label="D1" value={db} />
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">R2</dt>
              <dd>
                {r2.state === "ok" ? (
                  <Badge>{r2.detail}</Badge>
                ) : (
                  <StatusBadge
                    value={r2.state === "checking" ? "checking" : "down"}
                  />
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}

function StatusRow({ label, value }: { label: string; value: Health }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>
        <StatusBadge value={value} />
      </dd>
    </div>
  )
}

function StatusBadge({ value }: { value: Health }) {
  if (value === "checking") {
    return <Badge variant="secondary">Checking</Badge>
  }

  if (value === "ok") {
    return <Badge>Up</Badge>
  }

  return <Badge variant="destructive">Down</Badge>
}
