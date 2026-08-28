const TOKEN_BYTES = 24

export function generateToken() {
  const bytes = new Uint8Array(TOKEN_BYTES)
  crypto.getRandomValues(bytes)
  const body = [...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
  return `j4ck_${body}`
}

export function tokenPrefix(token: string) {
  return token.slice(0, 12)
}

export function isCliToken(value: string) {
  return /^j4ck_[0-9a-f]{48}$/.test(value)
}

export async function hashToken(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  )
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

export function bearerToken(header: string | undefined | null) {
  if (!header) {
    return null
  }
  const match = header.match(/^Bearer\s+(\S+)/i)
  const token = match?.[1]
  if (!token || !isCliToken(token)) {
    return null
  }
  return token
}
