import type { ReactNode } from "react"
import { Navigate } from "react-router"

import { authClient } from "@/lib/auth-client"

export function RequireSession({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return (
      <p className="flex flex-1 items-center text-sm text-muted-foreground">
        Loading
      </p>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return children
}
