import { useState, type FormEvent } from "react"
import { Navigate, useSearchParams } from "react-router"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { authClient } from "@/lib/auth-client"
import { safeCallbackPath } from "@/lib/login-redirect"

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
    return (
      <Navigate
        to={safeCallbackPath(searchParams.get("callbackURL"))}
        replace
      />
    )
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const { error: signInError } = await authClient.signIn.magicLink({
      email,
      name: email.split("@")[0] || email,
      callbackURL: safeCallbackPath(searchParams.get("callbackURL")),
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
      <div className="flex w-full max-w-md flex-col gap-8 border border-border bg-background/70 p-8 backdrop-blur-sm">
        <div className="flex flex-col gap-3">
          <p className="kicker">Access</p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
            Sign in to Jack AI
          </h1>
          {sentTo ? null : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Enter your email. We send a link. If you do not have an account
              yet, this creates one.
            </p>
          )}
        </div>
        {sentTo ? (
          <p className="text-sm leading-relaxed">
            Check {sentTo} for a link. It expires in 10 minutes. In local dev,
            Cloudflare writes the message to Worker logs instead of sending it.
          </p>
        ) : (
          <form className="flex flex-col gap-6" onSubmit={onSubmit}>
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
      </div>
    </div>
  )
}
