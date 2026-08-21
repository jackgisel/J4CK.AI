import { Link, NavLink, Outlet } from "react-router"

import { ConsentBanner } from "@/components/consent-banner"
import { ThemeToggle } from "@/components/theme-toggle"
import { authClient } from "@/lib/auth-client"

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-[0.625rem] font-semibold tracking-widest uppercase ${
    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
  }`

export function SiteShell() {
  const { data: session, isPending } = authClient.useSession()

  return (
    <div className="relative flex min-h-svh flex-col bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2 max-w-xl bg-[repeating-linear-gradient(90deg,transparent,transparent_31px,var(--border)_31px,var(--border)_32px)] opacity-60"
      />

      <header className="relative z-10 flex items-center justify-between gap-4 px-6 py-5 md:px-10">
        <Link
          to="/"
          className="font-heading text-xs font-semibold tracking-widest uppercase"
        >
          j4ck.ai
        </Link>
        <div className="flex items-center gap-4">
          {isPending ? null : session ? (
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

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-16 md:px-10">
        <Outlet />
      </main>

      <footer className="relative z-10 flex items-center gap-5 px-6 py-5 md:px-10">
        <NavLink to="/tos" className={navLinkClass}>
          Terms
        </NavLink>
        <NavLink to="/privacy" className={navLinkClass}>
          Privacy
        </NavLink>
      </footer>

      <ConsentBanner />
    </div>
  )
}
