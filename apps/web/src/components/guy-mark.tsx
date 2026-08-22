import { cn } from "@workspace/ui/lib/utils"
import { guyInitials } from "@/lib/guys"

export function GuyMark({
  name,
  color,
  className,
}: {
  name: string
  color: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center text-[0.625rem] font-semibold tracking-widest text-white uppercase",
        className
      )}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {guyInitials(name)}
    </span>
  )
}
