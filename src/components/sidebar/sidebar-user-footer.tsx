"use client"

import * as React from "react"
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useSidebar } from "@/components/ui/sidebar"

export function SidebarUserFooter() {
  const { state } = useSidebar()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton className="w-full justify-start h-auto py-3">
          <Avatar className="h-9 w-9">
            <AvatarImage data-ai-hint="avatar woman" src="https://placehold.co/40x40.png" />
            <AvatarFallback>ΧΡ</AvatarFallback>
          </Avatar>
          {state === "expanded" && (
            <div className="flex flex-col items-start ml-3">
              <span className="text-sm font-medium">Χρήστης</span>
              <span className="text-xs text-muted-foreground">
                user@example.com
              </span>
            </div>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
