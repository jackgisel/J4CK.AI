import { cn } from "@workspace/ui/lib/utils"

export function HeroField({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative mx-auto aspect-square w-full max-w-[min(28rem,100%)] overflow-hidden",
        className
      )}
    >
      <div className="absolute inset-x-0 top-1/2 h-px bg-foreground/15" />
      <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/15" />

      <Ring inset="0" className="border-foreground/10" />
      <Ring inset="12%" className="border-foreground/14" />
      <Ring inset="24%" className="border-foreground/20" />
      <Ring inset="36%" className="border-foreground/28" />

      <div className="absolute inset-0 animate-orbit">
        <span className="absolute top-[10%] left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-foreground" />
        <span className="absolute right-[8%] bottom-[28%] size-1 rounded-full bg-foreground/70" />
      </div>

      <div className="absolute inset-0 animate-radar">
        <div className="absolute top-[6%] left-1/2 h-[44%] w-px origin-bottom -translate-x-px bg-linear-to-b from-foreground/80 to-transparent" />
      </div>

      <div className="absolute inset-[46%] rounded-full bg-foreground shadow-[0_0_48px_color-mix(in_oklch,var(--foreground)_45%,transparent)]" />
    </div>
  )
}

function Ring({ inset, className }: { inset: string; className?: string }) {
  return (
    <div
      className={cn("absolute rounded-full border", className)}
      style={{ inset }}
    />
  )
}
