import {
  asAvatarEyes,
  asAvatarFacialHair,
  asAvatarHat,
  faceInk,
  mixHex,
  type AvatarEyes,
  type AvatarFacialHair,
  type AvatarHat,
  type AvatarSpec,
} from "@/lib/avatar"

const HAT_COLOR: Record<Exclude<AvatarHat, "none">, string> = {
  cap: "#1e3a5f",
  beanie: "#7f1d1d",
  hardhat: "#eab308",
  tophat: "#171717",
  cowboy: "#92400e",
}

export function GuyAvatar({
  color,
  avatarEyes,
  avatarFacialHair,
  avatarHat,
}: AvatarSpec) {
  const eyes = asAvatarEyes(avatarEyes)
  const facialHair = asAvatarFacialHair(avatarFacialHair)
  const hat = asAvatarHat(avatarHat)
  const ink = faceInk(color)
  const shade = mixHex(color, 0, 0.22)
  const sheen = mixHex(color, 255, 0.18)
  const showStud = hat === "none"

  return (
    <svg viewBox="0 0 64 80" className="size-full" aria-hidden>
      <rect x="26" y="64" width="12" height="10" fill={shade} />
      <rect x="14" y="24" width="36" height="42" rx="5" fill={color} />
      <rect x="44" y="28" width="6" height="34" fill={shade} opacity="0.55" />
      <rect x="16" y="26" width="26" height="5" fill={sheen} opacity="0.4" />
      {showStud ? <Stud color={color} sheen={sheen} shade={shade} /> : null}
      <Eyes kind={eyes} ink={ink} />
      {facialHair !== "beard" ? (
        <Mouth ink={ink} angry={eyes === "angry"} />
      ) : null}
      <FacialHair kind={facialHair} ink={ink} />
      {hat !== "none" ? <Hat kind={hat} /> : null}
    </svg>
  )
}

function Stud({
  color,
  sheen,
  shade,
}: {
  color: string
  sheen: string
  shade: string
}) {
  return (
    <g>
      <rect x="24" y="16" width="16" height="10" fill={color} />
      <rect x="36" y="16" width="4" height="10" fill={shade} opacity="0.5" />
      <ellipse cx="32" cy="16" rx="9" ry="4.5" fill={sheen} />
      <ellipse cx="32" cy="16" rx="5.5" ry="2.6" fill={color} />
    </g>
  )
}

function Eyes({ kind, ink }: { kind: AvatarEyes; ink: string }) {
  if (kind === "wide") {
    return (
      <g fill={ink}>
        <ellipse cx="25" cy="40" rx="5" ry="6" fill="#f8f5ef" />
        <ellipse cx="39" cy="40" rx="5" ry="6" fill="#f8f5ef" />
        <circle cx="26" cy="41" r="2.4" />
        <circle cx="40" cy="41" r="2.4" />
      </g>
    )
  }

  if (kind === "sleepy") {
    return (
      <g fill="none" stroke={ink} strokeWidth="1.8" strokeLinecap="square">
        <path d="M20 41 Q25 37 30 41" />
        <path d="M34 41 Q39 37 44 41" />
      </g>
    )
  }

  if (kind === "angry") {
    return (
      <g fill={ink} stroke={ink} strokeWidth="1.8" strokeLinecap="square">
        <path d="M19 34 L30 38" fill="none" />
        <path d="M45 34 L34 38" fill="none" />
        <rect x="22" y="39" width="7" height="4" />
        <rect x="35" y="39" width="7" height="4" />
      </g>
    )
  }

  if (kind === "squint") {
    return (
      <g stroke={ink} strokeWidth="2.2" strokeLinecap="square">
        <path d="M20 41 H30" />
        <path d="M34 41 H44" />
      </g>
    )
  }

  if (kind === "glasses") {
    return (
      <g fill="none" stroke={ink} strokeWidth="1.7" strokeLinecap="square">
        <rect x="18" y="35" width="12" height="10" />
        <rect x="34" y="35" width="12" height="10" />
        <path d="M30 40 H34" />
        <circle cx="24" cy="40" r="1.6" fill={ink} stroke="none" />
        <circle cx="40" cy="40" r="1.6" fill={ink} stroke="none" />
      </g>
    )
  }

  return (
    <g fill={ink}>
      <rect x="22" y="38" width="6" height="6" />
      <rect x="36" y="38" width="6" height="6" />
    </g>
  )
}

function Mouth({ ink, angry }: { ink: string; angry: boolean }) {
  if (angry) {
    return (
      <path
        d="M26 53 H38"
        fill="none"
        stroke={ink}
        strokeWidth="1.6"
        strokeLinecap="square"
      />
    )
  }

  return (
    <path
      d="M26 51 Q32 57 38 51"
      fill="none"
      stroke={ink}
      strokeWidth="1.6"
      strokeLinecap="square"
    />
  )
}

function FacialHair({ kind, ink }: { kind: AvatarFacialHair; ink: string }) {
  if (kind === "none") {
    return null
  }

  if (kind === "stubble") {
    return (
      <g fill={ink} opacity="0.55">
        <rect x="22" y="54" width="2" height="2" />
        <rect x="27" y="56" width="2" height="2" />
        <rect x="32" y="55" width="2" height="2" />
        <rect x="37" y="56" width="2" height="2" />
        <rect x="41" y="54" width="2" height="2" />
        <rect x="24" y="58" width="2" height="2" />
        <rect x="35" y="58" width="2" height="2" />
        <rect x="30" y="59" width="2" height="2" />
      </g>
    )
  }

  if (kind === "mustache") {
    return (
      <path
        d="M22 48 H29 L32 50 L35 48 H42 L36 53 L32 51 L28 53 Z"
        fill={ink}
      />
    )
  }

  if (kind === "goatee") {
    return <path d="M28 54 H36 L32 62 Z" fill={ink} />
  }

  return <path d="M18 48 H46 V58 Q32 70 18 58 Z" fill={ink} />
}

function Hat({ kind }: { kind: Exclude<AvatarHat, "none"> }) {
  const fill = HAT_COLOR[kind]
  const shade = mixHex(fill, 0, 0.25)

  if (kind === "cap") {
    return (
      <g>
        <rect x="16" y="12" width="32" height="14" fill={fill} />
        <rect x="40" y="12" width="8" height="14" fill={shade} />
        <path d="M14 26 H50 L58 30 H14 Z" fill={fill} />
      </g>
    )
  }

  if (kind === "beanie") {
    return (
      <g>
        <rect x="16" y="10" width="32" height="18" rx="2" fill={fill} />
        <rect x="40" y="12" width="8" height="16" fill={shade} />
        <rect x="16" y="24" width="32" height="4" fill={shade} />
        <rect
          x="29"
          y="6"
          width="6"
          height="6"
          fill={mixHex(fill, 255, 0.15)}
        />
      </g>
    )
  }

  if (kind === "hardhat") {
    return (
      <g>
        <path d="M12 24 H52 L46 12 H18 Z" fill={fill} />
        <rect x="30" y="8" width="4" height="10" fill={shade} />
        <rect x="10" y="22" width="44" height="5" fill={fill} />
      </g>
    )
  }

  if (kind === "tophat") {
    return (
      <g>
        <rect x="8" y="22" width="48" height="6" fill={fill} />
        <rect x="20" y="2" width="24" height="22" fill={fill} />
        <rect x="38" y="2" width="6" height="22" fill={shade} />
      </g>
    )
  }

  return (
    <g>
      <ellipse cx="32" cy="22" rx="28" ry="6" fill={fill} />
      <rect x="20" y="6" width="24" height="16" fill={fill} />
      <rect x="38" y="6" width="6" height="16" fill={shade} />
      <path d="M20 14 H44" stroke={shade} strokeWidth="2" />
    </g>
  )
}
