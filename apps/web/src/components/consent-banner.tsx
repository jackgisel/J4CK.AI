/* eslint-disable react-refresh/only-export-components */
import { useState } from "react"

import { Button } from "@workspace/ui/components/button"

const STORAGE_KEY = "privacy-consent"
const ACCEPTED = "1"

export function hasAcceptedConsent() {
  return localStorage.getItem(STORAGE_KEY) === ACCEPTED
}

export function ConsentBanner({
  accepted,
  onAgree,
}: {
  accepted?: boolean
  onAgree?: () => void
} = {}) {
  const [internalAccepted, setInternalAccepted] = useState(hasAcceptedConsent)
  const isAccepted = accepted ?? internalAccepted

  if (isAccepted) {
    return null
  }

  function agree() {
    localStorage.setItem(STORAGE_KEY, ACCEPTED)
    setInternalAccepted(true)
    onAgree?.()
  }

  return (
    <div
      role="region"
      aria-label="Privacy consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background px-6 py-4 md:px-10"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          A session cookie if you log in. Theme and this yes live in
          localStorage.
        </p>
        <Button type="button" onClick={agree}>
          Agree
        </Button>
      </div>
    </div>
  )
}
