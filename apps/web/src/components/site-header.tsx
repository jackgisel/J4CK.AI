import { useLocation } from "react-router"

import { Separator } from "@workspace/ui/components/separator"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { useThreadTitle } from "@/components/thread-title"

export function SiteHeader() {
  const { pathname } = useLocation()
  const threadTitle = useThreadTitle()

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <h1 className="truncate text-base font-medium">
          {headerTitle(pathname, threadTitle)}
        </h1>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

function headerTitle(pathname: string, threadTitle: string | null) {
  if (/^\/messages\/[^/]+$/.test(pathname)) {
    return threadTitle ?? "Messages"
  }
  if (pathname.startsWith("/contacts")) {
    return "Contacts"
  }
  if (pathname.startsWith("/messages")) {
    return "Messages"
  }
  return "Dashboard"
}
