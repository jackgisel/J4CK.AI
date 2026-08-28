export function safeCallbackPath(value: string | null | undefined) {
  if (!value) {
    return "/dashboard"
  }
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("://")
  ) {
    return "/dashboard"
  }
  return value
}
