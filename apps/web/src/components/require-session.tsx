import type { ReactNode } from "react"
import { Navigate } from "react-router"

import { PublicChrome } from "@/components/site-shell"
import { authClient } from "@/lib/auth-client"

export function RequireSession({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession()

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
    return <Navigate to="/login" replace />
  }

  return children
}
