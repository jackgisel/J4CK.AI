import type { ComponentProps } from "react"
import { Link, useLocation } from "react-router"
import {
  LaptopIcon,
  LayoutDashboardIcon,
  MessageSquareIcon,
  SparklesIcon,
  UsersIcon,
  WorkflowIcon,
} from "lucide-react"

import { BrandLockup } from "@/components/brand-mark"
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
    title: "Studio",
    url: "/studio",
    icon: SparklesIcon,
  },
  {
    title: "Workflows",
    url: "/workflows",
    icon: WorkflowIcon,
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
              className="h-auto data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link to="/dashboard" />}
            >
              <BrandLockup />
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
