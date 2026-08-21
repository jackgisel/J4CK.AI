import { useEffect, useState } from "react"
import { MoonIcon, SunIcon } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useTheme } from "@/components/theme-provider"

type Health = "checking" | "ok" | "down"

type R2Status =
  | { state: "checking" }
  | { state: "ok"; count: number }
  | { state: "down" }

export function App() {
  const { theme, setTheme } = useTheme()
  const [health, setHealth] = useState<Health>("checking")
  const [r2, setR2] = useState<R2Status>({ state: "checking" })

  useEffect(() => {
    fetch("/api/health")
      .then((response) => {
        if (!response.ok) {
          throw new Error("health check failed")
        }
        return response.json() as Promise<{ ok: boolean }>
      })
      .then((data) => {
        setHealth(data.ok ? "ok" : "down")
      })
      .catch(() => {
        setHealth("down")
      })

    fetch("/api/r2")
      .then((response) => {
        if (!response.ok) {
          throw new Error("r2 list failed")
        }
        return response.json() as Promise<{ objects: unknown[] }>
      })
      .then((data) => {
        setR2({ state: "ok", count: data.objects.length })
      })
      .catch(() => {
        setR2({ state: "down" })
      })
  }, [])

  const isDark = theme === "dark"

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2 max-w-xl bg-[repeating-linear-gradient(90deg,transparent,transparent_31px,var(--border)_31px,var(--border)_32px)] opacity-60"
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
        <p className="font-heading text-xs font-semibold tracking-widest uppercase">
          j4ck.ai
        </p>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => setTheme(isDark ? "light" : "dark")}
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </Button>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-6 py-16 md:px-10">
        <div className="flex max-w-xl flex-col gap-4">
          <Badge variant="secondary">Worker + R2</Badge>
          <h1 className="font-heading text-4xl font-semibold tracking-tight md:text-6xl">
            Jack Gisel
          </h1>
          <p className="max-w-md text-base leading-relaxed text-muted-foreground">
            A small site on Cloudflare. The page is static. The API runs in a
            Worker with an R2 bucket bound to it.
          </p>
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
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">API</dt>
                <dd>
                  <StatusBadge value={health} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">R2</dt>
                <dd>
                  {r2.state === "ok" ? (
                    <Badge>
                      {r2.count} object{r2.count === 1 ? "" : "s"}
                    </Badge>
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
      </main>
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
