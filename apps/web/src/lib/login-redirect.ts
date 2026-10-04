export function safeCallbackPath(value: string | null | undefined) {
  if (!value) {
    return "/tasks"
  }
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("://")
  ) {
    return "/tasks"
  }
  return value
}
