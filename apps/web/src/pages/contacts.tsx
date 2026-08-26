import { useEffect, useState } from "react"
import { Link } from "react-router"

import { Button } from "@workspace/ui/components/button"
import { GuyMark } from "@/components/guy-mark"
import { listGuys, type Guy } from "@/lib/guys"

export function ContactsPage() {
  const [guys, setGuys] = useState<Guy[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listGuys()
      .then((rows) => {
        if (!cancelled) {
          setGuys(rows)
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Could not load contacts"
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
          People you invent. Name, a brick head, a backstory. Train one from a
          skills repo.
        </p>
        <Button render={<Link to="/contacts/new" />}>New guy</Button>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : guys === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : guys.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          Nobody here yet. Make one.
        </p>
      ) : (
        <ul className="flex flex-col">
          {guys.map((row) => (
            <li key={row.id} className="border-b border-border first:border-t">
              <Link
                to={`/contacts/${row.id}`}
                className="flex items-center gap-4 py-4 hover:bg-muted/40"
              >
                <GuyMark
                  color={row.color}
                  avatarEyes={row.avatarEyes}
                  avatarFacialHair={row.avatarFacialHair}
                  avatarHat={row.avatarHat}
                />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-heading text-sm font-semibold tracking-wide uppercase">
                    {row.name}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">
                    {row.backstory.trim() || "No backstory"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
