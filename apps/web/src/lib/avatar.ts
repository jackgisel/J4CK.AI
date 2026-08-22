export const AVATAR_EYES = [
  "dots",
  "wide",
  "sleepy",
  "angry",
  "squint",
  "glasses",
] as const

export const AVATAR_FACIAL_HAIR = [
  "none",
  "stubble",
  "mustache",
  "beard",
  "goatee",
] as const

export const AVATAR_HATS = [
  "none",
  "cap",
  "beanie",
  "hardhat",
  "tophat",
  "cowboy",
] as const

export type AvatarEyes = (typeof AVATAR_EYES)[number]
export type AvatarFacialHair = (typeof AVATAR_FACIAL_HAIR)[number]
export type AvatarHat = (typeof AVATAR_HATS)[number]

export type AvatarSpec = {
  color: string
  avatarEyes: AvatarEyes
  avatarFacialHair: AvatarFacialHair
  avatarHat: AvatarHat
}

export const DEFAULT_AVATAR = {
  avatarEyes: "dots",
  avatarFacialHair: "none",
  avatarHat: "none",
} as const satisfies Omit<AvatarSpec, "color">

export function asAvatarEyes(value: string | undefined) {
  return includes(AVATAR_EYES, value) ? value : DEFAULT_AVATAR.avatarEyes
}

export function asAvatarFacialHair(value: string | undefined) {
  return includes(AVATAR_FACIAL_HAIR, value)
    ? value
    : DEFAULT_AVATAR.avatarFacialHair
}

export function asAvatarHat(value: string | undefined) {
  return includes(AVATAR_HATS, value) ? value : DEFAULT_AVATAR.avatarHat
}

function includes<T extends string>(
  list: readonly T[],
  value: string | undefined
): value is T {
  return !!value && list.includes(value as T)
}

export function parseHex(hex: string): [number, number, number] {
  const raw = hex.replace("#", "")
  return [
    Number.parseInt(raw.slice(0, 2), 16) || 0,
    Number.parseInt(raw.slice(2, 4), 16) || 0,
    Number.parseInt(raw.slice(4, 6), 16) || 0,
  ]
}

export function mixHex(hex: string, toward: number, amount: number) {
  const [r, g, b] = parseHex(hex)
  const mix = (channel: number) =>
    Math.round(channel + (toward - channel) * amount)
  return `#${[mix(r), mix(g), mix(b)]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`
}

export function faceInk(hex: string) {
  const [r, g, b] = parseHex(hex)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance < 0.42 ? "#f4f1ea" : "#1a1510"
}
