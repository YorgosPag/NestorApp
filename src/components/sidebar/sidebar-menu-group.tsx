"use client"

/**
 * ADR-871 §10.6 Υ13 — η **ομάδα** της στήλης: κουμπί που ανοίγει, **χωρίς** διεύθυνση
 * (Primer NavList · Carbon `SideNavMenu` · Atlassian `ExpandableMenuItem` · WAI-ARIA APG
 * *Disclosure Navigation*). Δύο μορφές:
 *
 *   • ανοιχτή στήλη     → disclosure (`aria-expanded`) με τη λίστα των συνδέσμων
 *   • συμπτυγμένη στήλη → εικονίδιο που ανοίγει popover με τους συνδέσμους
 *
 * Φωτισμός εκεί όπου **φαίνεται** η τρέχουσα σελίδα (ADR-871 §10.5 Υ11, Carbon roll-up):
 * στο παιδί όταν η ομάδα είναι ανοιχτή, στην ομάδα όταν είναι κλειστή ή η στήλη συμπτυγμένη.
 */

import * as React from "react"
import { Link } from '@/lib/workspace/navigation'
import { ChevronRight } from "lucide-react"
import {
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar"
import { SidebarHiddenRow } from "@/components/sidebar/sidebar-hidden-row"
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TRANSITION_PRESETS } from '@/components/ui/effects'
import { useIconSizes } from '@/hooks/useIconSizes'
import { cn } from "@/lib/utils"
import type { MenuGroup } from "@/types/sidebar"
import type { WorkspaceHref } from "@/lib/workspace/route-worlds"
import type { JobRevealView } from "@/hooks/useJobFilteredNavigation"
import {
  demotedClass,
  hiddenHereCount,
  prefetchHandlersFor,
  SidebarItemLabel,
  SubLinkBody,
  useSidebarLinkBehavior,
  WarningDot,
} from "@/components/sidebar/sidebar-menu-shared"

interface SidebarMenuGroupProps {
  group: MenuGroup
  isActive: boolean
  isExpanded: boolean
  activeHref: WorkspaceHref | null
  onToggleExpanded: (groupId: string) => void
  reveal?: JobRevealView
}

/** Οι σύνδεσμοι της ομάδας μέσα στο popover της συμπτυγμένης στήλης. */
function GroupPopoverLinks({ group, activeHref, reveal, onPicked }: {
  group: MenuGroup
  activeHref: WorkspaceHref | null
  reveal?: JobRevealView
  onPicked: () => void
}) {
  const { t, onNavigate } = useSidebarLinkBehavior()
  const iconSizes = useIconSizes()
  return (
    <nav className="mt-1 flex flex-col gap-0.5">
      {group.items.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          onClick={() => { onPicked(); onNavigate() }}
          {...prefetchHandlersFor(link.href)}
          aria-current={link.href === activeHref ? "page" : undefined}
          className={cn(
            "flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
            "hover:bg-accent hover:text-accent-foreground",
            "aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-accent-foreground",
            TRANSITION_PRESETS.FAST_ALL,
            demotedClass(reveal, link.href)
          )}
        >
          <SubLinkBody link={link} title={t(link.navLabelKey)} iconClassName={iconSizes.sm} />
        </Link>
      ))}
      {reveal !== undefined && (
        <SidebarHiddenRow count={hiddenHereCount(reveal, group.id)} onReveal={reveal.onReveal} />
      )}
    </nav>
  )
}

/** Συμπτυγμένη στήλη: εικονίδιο της ομάδας → popover στο hover (150ms κατά το κλείσιμο). */
function CollapsedGroup({ group, isActive, activeHref, reveal }: SidebarMenuGroupProps) {
  const { t } = useSidebarLinkBehavior()
  const [open, setOpen] = React.useState(false)
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  // Η καθυστέρηση στο κλείσιμο αποτρέπει το τρεμόπαιγμα στο κενό ανάμεσα σε trigger και περιεχόμενο.
  const openNow = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(true)
  }
  const closeSoon = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 150)
  }
  const Icon = group.icon
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <SidebarMenuButton
          isActive={isActive}
          className={cn(
            "group relative",
            TRANSITION_PRESETS.STANDARD_ALL,
            demotedClass(reveal, group.id)
          )}
          onMouseEnter={openNow}
          onMouseLeave={closeSoon}
        >
          <Icon className={TRANSITION_PRESETS.STANDARD_ALL} />
          {group.items.some((link) => link.warningDot) && <WarningDot className="absolute right-1 top-1" />}
        </SidebarMenuButton>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-48 p-1"
        onMouseEnter={openNow}
        onMouseLeave={closeSoon}
      >
        <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">{t(group.navLabelKey)}</p>
        <GroupPopoverLinks group={group} activeHref={activeHref} reveal={reveal} onPicked={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}

/** Η λίστα των συνδέσμων της ανοιχτής ομάδας (ανοιχτή στήλη). */
function ExpandedGroupLinks({ group, activeHref, reveal }: {
  group: MenuGroup
  activeHref: WorkspaceHref | null
  reveal?: JobRevealView
}) {
  const { t, onNavigate } = useSidebarLinkBehavior()
  const iconSizes = useIconSizes()
  const hiddenHere = hiddenHereCount(reveal, group.id)
  return (
    <SidebarMenuSub>
      {group.items.map((link) => (
        <SidebarMenuSubItem key={link.href}>
          <SidebarMenuSubButton
            asChild
            isActive={link.href === activeHref}
            className={cn(TRANSITION_PRESETS.STANDARD_ALL, demotedClass(reveal, link.href))}
          >
            <Link href={link.href} onClick={onNavigate} {...prefetchHandlersFor(link.href)}>
              <SubLinkBody link={link} title={t(link.navLabelKey)} iconClassName={iconSizes.sm} />
            </Link>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ))}
      {reveal !== undefined && hiddenHere > 0 && (
        <SidebarMenuSubItem>
          <SidebarHiddenRow count={hiddenHere} onReveal={reveal.onReveal} />
        </SidebarMenuSubItem>
      )}
    </SidebarMenuSub>
  )
}

/** Ανοιχτή στήλη: disclosure — κουμπί με `aria-expanded` και από κάτω οι σύνδεσμοι. */
function ExpandedGroup({ group, isActive, isExpanded, activeHref, onToggleExpanded, reveal }: SidebarMenuGroupProps) {
  const { t } = useSidebarLinkBehavior()
  const iconSizes = useIconSizes()
  // Ανοιχτή ομάδα ⇒ ο φωτισμός ανήκει στο παιδί· εδώ μένει μόνο το εικονίδιο (Υ11).
  const lit = isActive && !isExpanded
  return (
    <>
      <SidebarMenuButton
        onClick={() => onToggleExpanded(group.id)}
        isActive={lit}
        aria-expanded={isExpanded}
        className={cn(
          "group relative",
          TRANSITION_PRESETS.STANDARD_ALL,
          demotedClass(reveal, group.id)
        )}
      >
        <SidebarItemLabel item={group} title={t(group.navLabelKey)} />
        {group.items.some((link) => link.warningDot) && <WarningDot />}
        <ChevronRight
          className={cn(`ml-auto ${iconSizes.sm}`, TRANSITION_PRESETS.STANDARD_TRANSFORM, isExpanded && "rotate-90")}
        />
      </SidebarMenuButton>
      {isExpanded && <ExpandedGroupLinks group={group} activeHref={activeHref} reveal={reveal} />}
    </>
  )
}

export function SidebarMenuGroup(props: SidebarMenuGroupProps & { isCollapsed: boolean }) {
  const { isCollapsed, ...rest } = props
  return isCollapsed ? <CollapsedGroup {...rest} /> : <ExpandedGroup {...rest} />
}
