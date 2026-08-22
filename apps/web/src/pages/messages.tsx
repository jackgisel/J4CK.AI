import { useEffect, useState } from "react"
import { Link } from "react-router"

import { Button } from "@workspace/ui/components/button"
import { GuyMark } from "@/components/guy-mark"
import { RequireSession } from "@/components/require-session"
import { formatMessageTime, listGuys, type Guy } from "@/lib/guys"

export function MessagesPage() {
  return (
    <RequireSession>
      <ThreadList />
    </RequireSession>
  )
}

function ThreadList() {
  const [guys, setGuys] = useState<Guy[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listGuys()
      .then((rows) => {
        if (!cancelled) {
          setGuys(sortThreads(rows))
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Could not load messages"
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
        <div className="flex max-w-xl flex-col gap-2">
          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-5xl">
            Messages
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Your side of the thread. They do not write back yet.
          </p>
        </div>
        <Button variant="outline" render={<Link to="/contacts" />}>
          Contacts
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : guys === null ? (
        <p className="text-sm text-muted-foreground">Loading</p>
      ) : guys.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          No threads. Make a guy in Contacts, then write them.
        </p>
      ) : (
        <ul className="flex flex-col">
          {guys.map((row) => (
            <li key={row.id} className="border-b border-border first:border-t">
              <Link
                to={`/messages/${row.id}`}
                className="flex items-center gap-4 py-4 hover:bg-muted/40"
              >
                <GuyMark name={row.name} color={row.color} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-heading text-sm font-semibold tracking-wide uppercase">
                      {row.name}
                    </span>
                    {row.lastMessage ? (
                      <span className="shrink-0 text-[0.625rem] font-semibold tracking-widest text-muted-foreground uppercase">
                        {formatMessageTime(row.lastMessage.createdAt)}
                      </span>
                    ) : null}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">
                    {row.lastMessage?.body ?? "No messages"}
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

function sortThreads(rows: Guy[]) {
  return [...rows].sort((a, b) => {
    const aTime = a.lastMessage?.createdAt ?? a.createdAt
    const bTime = b.lastMessage?.createdAt ?? b.createdAt
    return bTime.localeCompare(aTime)
  })
}
