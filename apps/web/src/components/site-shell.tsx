import { useState, type ReactNode } from "react"
import { Link, NavLink, Outlet } from "react-router"

import {
  ConsentBanner,
  hasAcceptedConsent,
} from "@/components/consent-banner"
import { ThemeToggle } from "@/components/theme-toggle"
import { authClient } from "@/lib/auth-client"

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-[0.625rem] font-semibold tracking-widest uppercase ${
    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
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
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2 max-w-xl bg-[repeating-linear-gradient(90deg,transparent,transparent_31px,var(--border)_31px,var(--border)_32px)] opacity-60"
      />

      <header className="relative z-10 flex shrink-0 items-center justify-between gap-4 px-6 py-5 md:px-10">
        <Link
          to="/"
          className="font-heading text-xs font-semibold tracking-widest uppercase"
        >
          j4ck.ai
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-4">
          {session ? (
            <NavLink to="/dashboard" className={navLinkClass}>
              Dashboard
            </NavLink>
          ) : (
            <NavLink to="/login" className={navLinkClass}>
              Log in
            </NavLink>
          )}
          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-y-auto px-6 py-16 md:px-10">
        {children}
      </main>

      <footer
        className={`relative z-10 flex shrink-0 items-center gap-5 px-6 py-5 md:px-10 ${
          accepted ? "" : "pb-24"
        }`}
      >
        <NavLink to="/tos" className={navLinkClass}>
          Terms
        </NavLink>
        <NavLink to="/privacy" className={navLinkClass}>
          Privacy
        </NavLink>
      </footer>

      <ConsentBanner accepted={accepted} onAgree={() => setAccepted(true)} />
    </div>
  )
}
