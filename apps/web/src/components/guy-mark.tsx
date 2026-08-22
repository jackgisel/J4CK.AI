import { cn } from "@workspace/ui/lib/utils"
import { GuyAvatar } from "@/components/guy-avatar"
import {
  asAvatarEyes,
  asAvatarFacialHair,
  asAvatarHat,
  type AvatarSpec,
} from "@/lib/avatar"

export function GuyMark({
  color,
  avatarEyes,
  avatarFacialHair,
  avatarHat,
  className,
}: Partial<AvatarSpec> & { color: string; className?: string }) {
  return (
    <span
      className={cn("inline-block size-10 shrink-0", className)}
      aria-hidden
    >
      <GuyAvatar
        color={color}
        avatarEyes={asAvatarEyes(avatarEyes)}
        avatarFacialHair={asAvatarFacialHair(avatarFacialHair)}
        avatarHat={asAvatarHat(avatarHat)}
      />
    </span>
  )
}
