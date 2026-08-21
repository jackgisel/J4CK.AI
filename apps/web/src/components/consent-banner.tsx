import { useState } from "react"
import { Link } from "react-router"

import { Button } from "@workspace/ui/components/button"

const STORAGE_KEY = "privacy-consent"
const ACCEPTED = "1"

function hasAccepted() {
  return localStorage.getItem(STORAGE_KEY) === ACCEPTED
}

export function ConsentBanner() {
  const [accepted, setAccepted] = useState(hasAccepted)

  if (accepted) {
    return null
  }

  function agree() {
    localStorage.setItem(STORAGE_KEY, ACCEPTED)
    setAccepted(true)
  }

  return (
    <>
      <div aria-hidden className="h-36 shrink-0 sm:h-28" />
      <div
        role="region"
        aria-label="Privacy consent"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background px-6 py-5 md:px-10"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            I have to put this bar here. A session cookie if you log in. Theme
            and this yes live in localStorage. I do not sell anything. There is
            no reject button.{" "}
            <Link
              to="/privacy"
              className="text-foreground underline underline-offset-4 hover:text-muted-foreground"
            >
              Privacy
            </Link>
          </p>
          <Button type="button" onClick={agree}>
            I agree
          </Button>
        </div>
      </div>
    </>
  )
}
