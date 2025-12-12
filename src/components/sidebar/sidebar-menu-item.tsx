"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import {
  SidebarMenuItem as SidebarMenuItemPrimitive,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar"
import { SidebarBadge } from "@/components/sidebar/sidebar-badge"
import { cn } from "@/lib/utils"
import type { MenuItem } from "@/types/sidebar"
import { TRANSITION_PRESETS } from '@/components/ui/effects'

interface SidebarMenuItemProps {
  item: MenuItem
  isExpanded: boolean
  isActive: boolean
  onToggleExpanded: (title: string) => void
}

export function SidebarMenuItem({
  item,
  isExpanded,
  isActive,
  onToggleExpanded,
}: SidebarMenuItemProps) {
  const { isMobile, setOpenMobile } = useSidebar();

  // Handle navigation click with mobile sidebar auto-close
  const handleNavigationClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };
  return (
    <SidebarMenuItemPrimitive>
      {item.subItems ? (
        <>
          <SidebarMenuButton
            onClick={() => onToggleExpanded(item.title)}
            isActive={isActive}
            className={cn(
              "group relative",
              TRANSITION_PRESETS.STANDARD_ALL,
              isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
            )}
          >
            <item.icon
              className={cn(
                TRANSITION_PRESETS.STANDARD_ALL,
                isActive && "text-blue-600 dark:text-blue-400"
              )}
            />
            <span className="font-medium">{item.title}</span>
            {item.badge && <SidebarBadge badge={item.badge} />}
            <ChevronRight
              className={cn(
                "ml-auto h-4 w-4",
                TRANSITION_PRESETS.STANDARD_TRANSFORM,
                isExpanded && "rotate-90"
              )}
            />
          </SidebarMenuButton>
          {isExpanded && (
            <SidebarMenuSub>
              {item.subItems.map((subItem) => (
                <SidebarMenuSubItem key={subItem.title}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={isActive}
                    className={cn(
                      TRANSITION_PRESETS.STANDARD_ALL,
                      isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                    )}
                  >
                    <Link href={subItem.href} onClick={handleNavigationClick}>
                      <subItem.icon className="h-4 w-4" />
                      <span>{subItem.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          )}
        </>
      ) : (
        <SidebarMenuButton
          asChild
          isActive={isActive}
          className={cn(
            `group relative ${TRANSITION_PRESETS.FAST_ALL}`,
            isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
          )}
        >
          <Link href={item.href} onClick={handleNavigationClick}>
            <item.icon
              className={cn(
                TRANSITION_PRESETS.STANDARD_ALL,
                isActive && "text-blue-600 dark:text-blue-400"
              )}
            />
            <span className="font-medium">{item.title}</span>
            {item.badge && <SidebarBadge badge={item.badge} />}
          </Link>
        </SidebarMenuButton>
      )}
    </SidebarMenuItemPrimitive>
  )
}
