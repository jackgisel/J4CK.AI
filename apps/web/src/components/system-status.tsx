import { cn } from "@workspace/ui/lib/utils"
import type { Health, ServiceStatus } from "@/hooks/use-system-status"

export function SystemStatus({
  health,
  db,
  r2,
}: {
  health: Health
  db: Health
  r2: ServiceStatus
}) {
  return (
    <dl className="flex flex-wrap items-center gap-x-8 gap-y-3">
      <StatusRow label="Core" value={health} />
      <StatusRow label="Memory" value={db} />
      <div className="flex items-center gap-3">
        <dt className="kicker">Archive</dt>
        <dd>
          {r2.state === "ok" ? (
            <span className="font-mono text-[0.625rem] tracking-[0.2em] text-foreground uppercase">
              Online
              {r2.detail ? ` · ${r2.detail}` : ""}
            </span>
          ) : (
            <StatusLabel
              value={r2.state === "checking" ? "checking" : "down"}
            />
          )}
        </dd>
      </div>
    </dl>
  )
}

function StatusRow({ label, value }: { label: string; value: Health }) {
  return (
    <div className="flex items-center gap-3">
      <dt className="kicker">{label}</dt>
      <dd>
        <StatusLabel value={value} />
      </dd>
    </div>
  )
}

function StatusLabel({ value }: { value: Health }) {
  const label =
    value === "checking" ? "Checking" : value === "ok" ? "Online" : "Down"

  return (
    <span className="inline-flex items-center gap-2 font-mono text-[0.625rem] tracking-[0.2em] uppercase">
      <span
        className={cn(
          "size-1.5 rounded-full",
          value === "ok" && "bg-foreground",
          value === "checking" && "animate-pulse bg-muted-foreground",
          value === "down" && "bg-destructive"
        )}
      />
      <span
        className={value === "down" ? "text-destructive" : "text-foreground"}
      >
        {label}
      </span>
    </span>
  )
}
