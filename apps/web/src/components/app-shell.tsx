import type { CSSProperties } from "react"
import { Outlet } from "react-router"

import { AppSidebar } from "@/components/app-sidebar"
import { ConsentBanner } from "@/components/consent-banner"
import { RequireSession } from "@/components/require-session"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@workspace/ui/components/sidebar"

export function AppShell() {
  return (
    <RequireSession>
      <SidebarProvider
        className="h-svh overflow-hidden"
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset className="min-h-0 overflow-hidden">
          <SiteHeader />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 lg:p-6">
            <Outlet />
          </div>
          <ConsentBanner />
        </SidebarInset>
      </SidebarProvider>
    </RequireSession>
  )
}
