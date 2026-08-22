import type { CSSProperties } from "react"
import { Outlet, useLocation } from "react-router"

import { AppSidebar } from "@/components/app-sidebar"
import { ConsentBanner } from "@/components/consent-banner"
import { RequireSession } from "@/components/require-session"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@workspace/ui/components/sidebar"

export function AppShell() {
  const { pathname } = useLocation()
  const isThread = /^\/messages\/[^/]+$/.test(pathname)
  const isDashboard = pathname === "/dashboard"

  return (
    <RequireSession>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div
            className={
              isThread
                ? "flex min-h-0 flex-1 flex-col overflow-hidden p-4 lg:p-6"
                : isDashboard
                  ? "flex min-h-0 flex-1 flex-col overflow-y-auto"
                  : "flex min-h-0 flex-1 flex-col overflow-y-auto p-4 lg:p-6"
            }
          >
            <Outlet />
          </div>
          <ConsentBanner />
        </SidebarInset>
      </SidebarProvider>
    </RequireSession>
  )
}
