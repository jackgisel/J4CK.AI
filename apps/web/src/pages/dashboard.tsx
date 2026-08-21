import { Navigate, useNavigate } from "react-router"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { authClient } from "@/lib/auth-client"

export function DashboardPage() {
  const { data: session, isPending } = authClient.useSession()
  const navigate = useNavigate()

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

  async function signOut() {
    await authClient.signOut()
    navigate("/")
  }

  return (
    <div className="flex flex-1 flex-col justify-center gap-8">
      <div className="flex max-w-xl flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-5xl">
          Dashboard
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          You are signed in. This is the logged-in area.
        </p>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Magic link session on D1.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <dl className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <dt className="text-[0.625rem] font-semibold tracking-widest text-muted-foreground uppercase">
                Email
              </dt>
              <dd>{session.user.email}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-[0.625rem] font-semibold tracking-widest text-muted-foreground uppercase">
                Name
              </dt>
              <dd>{session.user.name}</dd>
            </div>
          </dl>
          <Button variant="outline" onClick={signOut}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
