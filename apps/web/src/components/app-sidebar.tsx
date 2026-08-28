import type { ComponentProps } from "react"
import { Link, useLocation } from "react-router"
import {
  LaptopIcon,
  LayoutDashboardIcon,
  MessageSquareIcon,
  UsersIcon,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"
import { authClient } from "@/lib/auth-client"

const navMain = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboardIcon,
  },
  {
    title: "Contacts",
    url: "/contacts",
    icon: UsersIcon,
  },
  {
    title: "Messages",
    url: "/messages",
    icon: MessageSquareIcon,
  },
  {
    title: "Mac",
    url: "/cli",
    icon: LaptopIcon,
  },
]

export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const { data: session } = authClient.useSession()
  const { pathname } = useLocation()
  const user = session?.user

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link to="/dashboard" />}
            >
              <span className="font-heading text-base font-semibold tracking-wider uppercase">
                j4ck.ai
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} pathname={pathname} />
        <NavSecondary className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        {user ? (
          <NavUser
            user={{
              name: user.name || user.email,
              email: user.email,
              image: user.image,
            }}
          />
        ) : null}
      </SidebarFooter>
    </Sidebar>
  )
}
