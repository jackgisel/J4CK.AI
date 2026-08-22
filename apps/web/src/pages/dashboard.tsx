import { useEffect, useState } from "react"

import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { GuysTable } from "@/components/guys-table"
import { SectionCards } from "@/components/section-cards"
import {
  getGuyStats,
  listGuys,
  type Guy,
  type GuyDayStat,
} from "@/lib/guys"

export function DashboardPage() {
  const [guys, setGuys] = useState<Guy[] | null>(null)
  const [series, setSeries] = useState<GuyDayStat[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([listGuys(), getGuyStats()])
      .then(([rows, stats]) => {
        if (cancelled) {
          return
        }
        setGuys(rows)
        setSeries(stats.series)
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Could not load dashboard"
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <p className="px-4 py-6 text-sm text-destructive lg:px-6" role="alert">
        {error}
      </p>
    )
  }

  if (guys === null || series === null) {
    return (
      <p className="px-4 py-6 text-sm text-muted-foreground lg:px-6">Loading</p>
    )
  }

  const active = guys.filter((row) => row.lastMessage).length
  const waiting = guys.filter((row) => row.lastMessage?.role === "user").length
  const quiet = guys.filter((row) => !row.lastMessage).length

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <SectionCards
            guys={guys.length}
            active={active}
            waiting={waiting}
            quiet={quiet}
          />
          <div className="px-4 lg:px-6">
            <ChartAreaInteractive series={series} />
          </div>
          <GuysTable guys={guys} />
        </div>
      </div>
    </div>
  )
}
