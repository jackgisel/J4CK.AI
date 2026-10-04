import { Link } from "react-router"

import { cn } from "@workspace/ui/lib/utils"

export function BrandLockup({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span
        aria-hidden
        className="inline-flex size-7 items-center justify-center border border-foreground font-heading text-[0.7rem] font-bold tracking-tight"
      >
        J
      </span>
      <span className="font-heading text-sm font-semibold tracking-[0.28em] uppercase">
        Jack AI
      </span>
    </span>
  )
}

export function BrandMark({
  to = "/",
  className,
}: {
  to?: string
  className?: string
}) {
  return (
    <Link to={to} className={cn("text-foreground", className)}>
      <BrandLockup />
    </Link>
  )
}
