import { useState, type ReactNode } from "react"
import { NavLink, Outlet } from "react-router"

import { BrandMark } from "@/components/brand-mark"
import { ConsentBanner, hasAcceptedConsent } from "@/components/consent-banner"
import { ThemeToggle } from "@/components/theme-toggle"
import { authClient } from "@/lib/auth-client"

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `kicker transition-colors ${
    isActive ? "text-foreground" : "hover:text-foreground"
  }`

export function SiteShell() {
  return (
    <PublicChrome>
      <Outlet />
    </PublicChrome>
  )
}

export function PublicChrome({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession()
  const [accepted, setAccepted] = useState(hasAcceptedConsent)

  return (
    <div className="relative flex h-svh flex-col overflow-hidden bg-background">
      <div
        aria-hidden
        className="atmosphere-grid pointer-events-none absolute inset-0"
      />
      <div
        aria-hidden
        className="atmosphere-vignette pointer-events-none absolute inset-0"
      />

      <header className="relative z-10 flex shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-4 md:px-10">
        <BrandMark />
        <div className="flex flex-wrap items-center justify-end gap-5">
          {session ? (
            <NavLink to="/dashboard" className={navLinkClass}>
              Studio
            </NavLink>
          ) : (
            <NavLink to="/login" className={navLinkClass}>
              Enter
            </NavLink>
          )}
          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-y-auto px-6 py-10 md:px-10">
        {children}
      </main>

      <footer
        className={`relative z-10 flex shrink-0 items-center gap-6 border-t border-border px-6 py-4 md:px-10 ${
          accepted ? "" : "pb-24"
        }`}
      >
        <NavLink to="/tos" className={navLinkClass}>
          Terms
        </NavLink>
        <NavLink to="/privacy" className={navLinkClass}>
          Privacy
        </NavLink>
        <span className="ml-auto hidden font-mono text-[0.625rem] tracking-[0.24em] text-muted-foreground uppercase sm:inline">
          j4ck.ai
        </span>
      </footer>

      <ConsentBanner accepted={accepted} onAgree={() => setAccepted(true)} />
    </div>
  )
}
