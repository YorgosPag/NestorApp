"use client"

/**
 * Ένας κόμβος της στήλης — **σύνδεσμος** ή **ομάδα** (ADR-871 §10.6 Υ13).
 *
 * Η διακλάδωση γίνεται στο **είδος** (`kind`), όχι στο «έχει `subItems`;». Ο σύνδεσμος
 * αποδίδεται εδώ· η ομάδα στο `sidebar-menu-group.tsx`· ό,τι μοιράζονται στο
 * `sidebar-menu-shared.tsx`.
 */

import * as React from "react"
import { Link } from '@/lib/workspace/navigation'
import {
  SidebarMenuItem as SidebarMenuItemPrimitive,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import type { MenuEntry, MenuLink } from "@/types/sidebar"
import type { WorkspaceHref } from "@/lib/workspace/route-worlds"
import { containsActive } from "@/components/sidebar/active-navigation"
import { SidebarMenuGroup } from "@/components/sidebar/sidebar-menu-group"
import { MenuCountBadge } from "@/components/sidebar/menu-count-badge"
import {
  demotedClass,
  prefetchHandlersFor,
  SidebarItemLabel,
  useSidebarLinkBehavior,
} from "@/components/sidebar/sidebar-menu-shared"
import type { JobRevealView } from "@/hooks/useJobFilteredNavigation"
import { TRANSITION_PRESETS } from '@/components/ui/effects'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import '@/lib/design-system';

interface SidebarMenuItemProps {
  item: MenuEntry
  /** Μόνο για ομάδα: είναι ανοιχτή; */
  isExpanded: boolean
  /** Ο ένας ενεργός σύνδεσμος όλου του καταλόγου (ADR-871 §10.5 Υ11). */
  activeHref: WorkspaceHref | null
  onToggleExpanded: (groupId: string) => void
  /** ADR-748 Φάση 3.6 — τα επίπεδα 2 & 3 του δείκτη. Απόν ⇒ καμία αλλαγή. */
  reveal?: JobRevealView
}

interface LinkItemProps {
  link: MenuLink
  isActive: boolean
  isCollapsed: boolean
  reveal?: JobRevealView
}

/** Σύνδεσμος πρώτου επιπέδου: συμπτυγμένη στήλη ⇒ εικονίδιο + tooltip· ανοιχτή ⇒ πλήρης γραμμή. */
function SidebarMenuLinkItem({ link, isActive, isCollapsed, reveal }: LinkItemProps) {
  const { t, onNavigate } = useSidebarLinkBehavior()
  const title = t(link.navLabelKey)
  const button = (
    <SidebarMenuButton
      asChild
      isActive={isActive}
      className={cn(
        `group relative ${TRANSITION_PRESETS.FAST_ALL}`,
        demotedClass(reveal, link.href)
      )}
    >
      <Link href={link.href} onClick={onNavigate} {...prefetchHandlersFor(link.href)}>
        {isCollapsed ? (
          <>
            <link.icon className={TRANSITION_PRESETS.STANDARD_ALL} />
            {/* 🔢 Συμπτυγμένη στήλη: το σήμα κάθεται πάνω στο εικονίδιο (ο σύνδεσμος είναι ήδη `relative`). */}
            {link.countSource !== undefined && <MenuCountBadge source={link.countSource} placement="top-end" />}
          </>
        ) : (
          <SidebarItemLabel item={link} title={title} />
        )}
      </Link>
    </SidebarMenuButton>
  )
  if (!isCollapsed) return button
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>{title}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function SidebarMenuItem({
  item,
  isExpanded,
  activeHref,
  onToggleExpanded,
  reveal,
}: SidebarMenuItemProps) {
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'
  /**
   * ADR-871 §10.5 Υ11 — **περιέχει** αυτός ο κόμβος την τρέχουσα σελίδα (ο ίδιος ή, για
   * ομάδα, κάποιο παιδί της). Πού πηγαίνει ο **πλήρης** φωτισμός το αποφασίζει η ομάδα.
   */
  const isActive = containsActive(item, activeHref)

  return (
    <SidebarMenuItemPrimitive>
      {item.kind === 'group' ? (
        <SidebarMenuGroup
          group={item}
          isActive={isActive}
          isExpanded={isExpanded}
          isCollapsed={isCollapsed}
          activeHref={activeHref}
          onToggleExpanded={onToggleExpanded}
          reveal={reveal}
        />
      ) : (
        <SidebarMenuLinkItem link={item} isActive={isActive} isCollapsed={isCollapsed} reveal={reveal} />
      )}
    </SidebarMenuItemPrimitive>
  )
}
