import { useState, type FormEvent } from "react"
import { Navigate, useSearchParams } from "react-router"

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
import { authClient } from "@/lib/auth-client"

const VERIFY_ERRORS: Record<string, string> = {
  INVALID_TOKEN: "That link is invalid or already used. Request a new one.",
  EXPIRED_TOKEN: "That link expired. Request a new one.",
}

export function LoginPage() {
  const { data: session, isPending } = authClient.useSession()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState("")
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(
    VERIFY_ERRORS[searchParams.get("error") ?? ""] ??
      (searchParams.get("error") ? "Could not verify that sign-in link." : null)
  )
  const [submitting, setSubmitting] = useState(false)

  if (!isPending && session) {
    return <Navigate to="/dashboard" replace />
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const { error: signInError } = await authClient.signIn.magicLink({
      email,
      name: email.split("@")[0] || email,
      callbackURL: "/dashboard",
      errorCallbackURL: "/login",
    })

    setSubmitting(false)

    if (signInError) {
      setError(signInError.message || "Could not send the link.")
      return
    }

    setSentTo(email)
  }

  return (
    <div className="flex flex-1 flex-col justify-center">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Log in</CardTitle>
          <CardDescription>
            Enter your email. We send a sign-in link. If you do not have an
            account yet, this creates one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sentTo ? (
            <p className="text-sm leading-relaxed">
              Check {sentTo} for a link. It expires in 10 minutes. In local
              dev, Cloudflare writes the message to Worker logs instead of
              sending it.
            </p>
          ) : (
            <form className="flex flex-col gap-5" onSubmit={onSubmit}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  spellCheck={false}
                  required
                  className="min-h-10"
                  value={email}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={submitting}>
                {submitting ? "Sending…" : "Email me a link"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
