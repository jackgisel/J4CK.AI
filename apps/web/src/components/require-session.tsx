import type { ReactNode } from "react"
import { Navigate, useLocation } from "react-router"

import { PublicChrome } from "@/components/site-shell"
import { authClient } from "@/lib/auth-client"

export function RequireSession({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession()
  const location = useLocation()

  if (isPending) {
    return (
      <PublicChrome>
        <p className="flex flex-1 items-center text-sm text-muted-foreground">
          Loading…
        </p>
      </PublicChrome>
    )
  }

  if (!session) {
    const next = `${location.pathname}${location.search}`
    return (
      <Navigate to={`/login?callbackURL=${encodeURIComponent(next)}`} replace />
    )
  }

  return children
}
