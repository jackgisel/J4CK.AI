import { useEffect, useState } from "react"

export type Health = "checking" | "ok" | "down"

export type ServiceStatus =
  { state: "checking" } | { state: "ok"; detail?: string } | { state: "down" }

export type SystemStatus = {
  health: Health
  db: Health
  r2: ServiceStatus
}

export function useSystemStatus(): SystemStatus {
  const [health, setHealth] = useState<Health>("checking")
  const [db, setDb] = useState<Health>("checking")
  const [r2, setR2] = useState<ServiceStatus>({ state: "checking" })

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    fetch("/api/health", { signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error("health check failed")
        }
        return response.json() as Promise<{ ok: boolean; db: boolean }>
      })
      .then((data) => {
        setHealth(data.ok ? "ok" : "down")
        setDb(data.db ? "ok" : "down")
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }
        setHealth("down")
        setDb("down")
      })

    fetch("/api/r2", { signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error("r2 list failed")
        }
        return response.json() as Promise<{ objects: unknown[] }>
      })
      .then((data) => {
        setR2({
          state: "ok",
          detail: `${data.objects.length} object${data.objects.length === 1 ? "" : "s"}`,
        })
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }
        setR2({ state: "down" })
      })

    return () => {
      controller.abort()
    }
  }, [])

  return { health, db, r2 }
}
