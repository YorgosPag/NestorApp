"use client"

import * as React from "react"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
} from "@/components/ui/sidebar"
import { SidebarMenuItem } from "@/components/sidebar/sidebar-menu-item"
import { cn } from "@/lib/utils"
import type { MenuItem } from "@/types/sidebar"

interface SidebarMenuSectionProps {
  label?: string
  items: MenuItem[]
  expandedItems: string[]
  onToggleExpanded: (title: string) => void
  isItemActive: (href: string) => boolean
  className?: string
}

export function SidebarMenuSection({
  label,
  items,
  expandedItems,
  onToggleExpanded,
  isItemActive,
  className,
}: SidebarMenuSectionProps) {
  return (
    <SidebarGroup className={cn(className)}>
      {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem
              key={item.title}
              item={item}
              isExpanded={expandedItems.includes(item.title)}
              isActive={isItemActive(item.href)}
              onToggleExpanded={onToggleExpanded}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
