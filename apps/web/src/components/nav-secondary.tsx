import type { ComponentPropsWithoutRef } from "react"
import { Link } from "react-router"
import { FileTextIcon, ShieldIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

const items = [
  {
    title: "Terms",
    url: "/tos",
    icon: FileTextIcon,
  },
  {
    title: "Privacy",
    url: "/privacy",
    icon: ShieldIcon,
  },
]

export function NavSecondary({
  ...props
}: ComponentPropsWithoutRef<typeof SidebarGroup>) {
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton render={<Link to={item.url} />}>
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
