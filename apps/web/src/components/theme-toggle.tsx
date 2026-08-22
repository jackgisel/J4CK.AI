import * as React from "react"
import { MoonIcon, SunIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { useTheme } from "@/components/theme-provider"

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [systemDark, setSystemDark] = React.useState(() =>
    window.matchMedia(COLOR_SCHEME_QUERY).matches
  )

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(COLOR_SCHEME_QUERY)
    const handleChange = () => {
      setSystemDark(mediaQuery.matches)
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [])

  const isDark = theme === "dark" || (theme === "system" && systemDark)

  return (
    <Button
      variant="outline"
      size="icon-sm"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </Button>
  )
}
