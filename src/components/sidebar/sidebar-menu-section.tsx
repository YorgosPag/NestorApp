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
import type { JobRevealView } from "@/hooks/useJobFilteredNavigation"
import '@/lib/design-system';

interface SidebarMenuSectionProps {
  label?: string
  items: MenuItem[]
  expandedItems: string[]
  onToggleExpanded: (title: string) => void
  isItemActive: (href: string) => boolean
  className?: string
  /**
   * ADR-748 Φάση 3.6 — τα επίπεδα 2 & 3 ταξιδεύουν ως **ένα** prop.
   * Πέντε ξεχωριστά props θα ήταν πέντε ευκαιρίες να ξεχαστεί το ένα σε μία
   * από τις τρεις χρήσεις του `AppSidebar` — και το φίλτρο θα δούλευε
   * διαφορετικά ανά ενότητα χωρίς να το δει κανείς.
   */
  reveal?: JobRevealView
}

export function SidebarMenuSection({
  label,
  items,
  expandedItems,
  onToggleExpanded,
  isItemActive,
  className,
  reveal,
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
              reveal={reveal}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
