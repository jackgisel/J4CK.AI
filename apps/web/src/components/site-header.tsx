import { useLocation } from "react-router"

import { Separator } from "@workspace/ui/components/separator"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"

export function SiteHeader() {
  const { pathname } = useLocation()

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <h1 className="text-base font-medium">{headerTitle(pathname)}</h1>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

function headerTitle(pathname: string) {
  if (pathname.startsWith("/contacts")) {
    return "Contacts"
  }
  if (pathname.startsWith("/messages")) {
    return "Messages"
  }
  return "Dashboard"
}
