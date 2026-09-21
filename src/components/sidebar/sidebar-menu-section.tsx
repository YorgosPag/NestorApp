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
import type { MenuEntry } from "@/types/sidebar"
import { navNodeKey } from "@/config/navigation-node"
import type { WorkspaceHref } from "@/lib/workspace/route-worlds"
import type { JobRevealView } from "@/hooks/useJobFilteredNavigation"
import '@/lib/design-system';

interface SidebarMenuSectionProps {
  label?: string
  items: readonly MenuEntry[]
  /** Τα `id` των ανοιχτών ομάδων (ADR-871 §10.6 Υ20). */
  expandedItems: string[]
  onToggleExpanded: (groupId: string) => void
  /** Το ένα ενεργό στοιχείο **όλου** του καταλόγου — από το `useSidebarState` (ADR-871 §10.5 Υ11). */
  activeHref: WorkspaceHref | null
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
  activeHref,
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
              key={navNodeKey(item)}
              item={item}
              isExpanded={item.kind === "group" && expandedItems.includes(item.id)}
              activeHref={activeHref}
              onToggleExpanded={onToggleExpanded}
              reveal={reveal}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
