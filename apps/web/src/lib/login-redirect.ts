export function safeCallbackPath(value: string | null | undefined) {
  if (!value) {
    return "/board"
  }
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("://")
  ) {
    return "/board"
  }
  return value
}
