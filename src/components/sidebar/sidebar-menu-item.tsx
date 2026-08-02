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
import { SidebarHiddenRow } from "@/components/sidebar/sidebar-hidden-row"
import { cn } from "@/lib/utils"
import type { MenuItem } from "@/types/sidebar"
import type { JobRevealView } from "@/hooks/useJobFilteredNavigation"
import { TRANSITION_PRESETS } from '@/components/ui/effects'
import { useIconSizes } from '@/hooks/useIconSizes'
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy'
import { preloadOnHover, getPreloadableRouteFromHref } from '@/utils/preloadRoutes'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import '@/lib/design-system';

interface SidebarMenuItemProps {
  item: MenuItem
  isExpanded: boolean
  isActive: boolean
  onToggleExpanded: (title: string) => void
  /** ADR-748 Φάση 3.6 — τα επίπεδα 2 & 3 του δείκτη. Απόν ⇒ καμία αλλαγή. */
  reveal?: JobRevealView
}

/**
 * ADR-748 **Α-2 — υποβάθμιση πριν από εξαφάνιση** *(πρότυπο: το half-tone του
 * Revit)*. Κατά την «Αποκάλυψη» το κρυμμένο στοιχείο ξαναμπαίνει **στη θέση
 * του**, οπτικά υποχωρημένο αλλά **πλήρως λειτουργικό**: η δουλειά είναι
 * ετικέτα ορατότητας, **ποτέ** πύλη (§14.5) — άρα απενεργοποίησή του θα
 * προσποιούνταν περιορισμό που δεν υπάρχει (Ε14.ζ).
 */
const DEMOTED_CLASS = "opacity-50 saturate-50"

function demotedClass(reveal: JobRevealView | undefined, href: string): string | false {
  return reveal?.isRevealing === true && reveal.hiddenHrefs.has(href) && DEMOTED_CLASS
}

/**
 * Το κοινό σώμα ενός στοιχείου πρώτου επιπέδου: **εικονίδιο · τίτλος · σήμα**.
 *
 * ⚠️ Εξήχθη επειδή το CHECK 3.28 (jscpd) το έπιασε ως **structural clone** μέσα
 * στο ίδιο αρχείο: το ίδιο σώμα αποδιδόταν δύο φορές — μία στο κουμπί του
 * γονιού-δοχείου και μία στο απλό στοιχείο. Ήταν οριακά κάτω από το κατώφλι
 * και η Φάση 3.6 το έσπρωξε από πάνω. Η σωστή αντίδραση δεν είναι να χαλαρώσει
 * το κατώφλι (N.18) — είναι να υπάρχει **ένα** σώμα: αλλιώς η επόμενη αλλαγή
 * στην ετικέτα θα εφαρμοζόταν στο ένα από τα δύο, σιωπηλά.
 */
function SidebarItemLabel({
  item,
  isActive,
  title,
}: {
  item: MenuItem
  isActive: boolean
  title: string
}) {
  const Icon = item.icon
  return (
    <>
      <Icon
        className={cn(
          TRANSITION_PRESETS.STANDARD_ALL,
          isActive && "text-primary"
        )}
      />
      <span className="font-medium">{title}</span>
      {item.badge && <SidebarBadge badge={item.badge} />}
    </>
  )
}

/** Πόσα υπο-στοιχεία λείπουν από **αυτό** το δοχείο (Επίπεδο 2). */
function hiddenHereCount(reveal: JobRevealView | undefined, href: string): number {
  // Στην «Αποκάλυψη» τα στοιχεία είναι ήδη ορατά — ο δείκτης θα ήταν αντιφατικός.
  if (reveal === undefined || reveal.isRevealing) return 0
  return reveal.hiddenSubItemCountByParent.get(href) ?? 0
}

export function SidebarMenuItem({
  item,
  isExpanded,
  isActive,
  onToggleExpanded,
  reveal,
}: SidebarMenuItemProps) {
  const { state, isMobile, setOpenMobile, setOpen } = useSidebar();
  const iconSizes = useIconSizes();
  const { t, isLoading } = useTranslationLazy('navigation');
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCollapsed = state === 'collapsed';

  const translateTitle = (title: string): string => {
    if (isLoading) return title;
    if (title.includes('.')) {
      const translated = t(title);
      return translated === title ? title : translated;
    }
    return title;
  };

  const handleNavigationClick = (href: string) => {
    if (isMobile) {
      setOpenMobile(false);
    } else if (href === '/dxf/viewer' || href === '/geo/canvas') {
      setOpen(false);
    }
  };

  const getHoverPrefetchHandlers = (href: string) => {
    const preloadableRoute = getPreloadableRouteFromHref(href);
    if (!preloadableRoute) return {};
    return preloadOnHover(preloadableRoute);
  };

  // Hover popover — 150ms delay on close prevents gap flicker between trigger and content
  const openPopover = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setPopoverOpen(true);
  };
  const closePopover = () => {
    closeTimerRef.current = setTimeout(() => setPopoverOpen(false), 150);
  };

  const hasChildWarning = item.subItems?.some((s) => s.warningDot) ?? false;

  // ── COLLAPSED + GROUP ITEM → hover popover with sub-links ──────────────────
  if (isCollapsed && item.subItems) {
    return (
      <SidebarMenuItemPrimitive>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <SidebarMenuButton
              isActive={isActive}
              className={cn(
                "group relative",
                TRANSITION_PRESETS.STANDARD_ALL,
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
                demotedClass(reveal, item.href)
              )}
              onMouseEnter={openPopover}
              onMouseLeave={closePopover}
            >
              <item.icon
                className={cn(
                  TRANSITION_PRESETS.STANDARD_ALL,
                  isActive && "text-primary"
                )}
              />
              {hasChildWarning && (
                <span
                  className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[hsl(var(--text-warning))]"
                  aria-hidden
                />
              )}
            </SidebarMenuButton>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="start"
            sideOffset={8}
            className="w-48 p-1"
            onMouseEnter={openPopover}
            onMouseLeave={closePopover}
          >
            <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">
              {translateTitle(item.title)}
            </p>
            <nav className="mt-1 flex flex-col gap-0.5">
              {item.subItems.map((subItem) => (
                <Link
                  key={subItem.href}
                  href={subItem.href}
                  onClick={() => { setPopoverOpen(false); handleNavigationClick(subItem.href); }}
                  {...getHoverPrefetchHandlers(subItem.href)}
                  className={cn(
                    "flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                    "hover:bg-accent hover:text-accent-foreground",
                    TRANSITION_PRESETS.FAST_ALL,
                    demotedClass(reveal, subItem.href)
                  )}
                >
                  <subItem.icon className={iconSizes.sm} />
                  <span>{translateTitle(subItem.title)}</span>
                  {subItem.warningDot && (
                    <span
                      className="ml-auto h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--text-warning))]"
                      aria-hidden
                    />
                  )}
                </Link>
              ))}
              {reveal !== undefined && (
                <SidebarHiddenRow
                  count={hiddenHereCount(reveal, item.href)}
                  onReveal={reveal.onReveal}
                />
              )}
            </nav>
          </PopoverContent>
        </Popover>
      </SidebarMenuItemPrimitive>
    );
  }

  // ── COLLAPSED + SIMPLE ITEM → tooltip ──────────────────────────────────────
  if (isCollapsed) {
    return (
      <SidebarMenuItemPrimitive>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarMenuButton
                asChild
                isActive={isActive}
                className={cn(
                  `group relative ${TRANSITION_PRESETS.FAST_ALL}`,
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                )}
              >
                <Link
                  href={item.href}
                  onClick={() => handleNavigationClick(item.href)}
                  {...getHoverPrefetchHandlers(item.href)}
                >
                  <item.icon
                    className={cn(
                      TRANSITION_PRESETS.STANDARD_ALL,
                      isActive && "text-primary"
                    )}
                  />
                </Link>
              </SidebarMenuButton>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {translateTitle(item.title)}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </SidebarMenuItemPrimitive>
    );
  }

  // ── EXPANDED → normal rendering ────────────────────────────────────────────
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
              isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
              demotedClass(reveal, item.href)
            )}
          >
            <SidebarItemLabel item={item} isActive={isActive} title={translateTitle(item.title)} />
            {hasChildWarning && (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--text-warning))]"
                aria-hidden
              />
            )}
            <ChevronRight
              className={cn(
                `ml-auto ${iconSizes.sm}`,
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
                      isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
                      demotedClass(reveal, subItem.href)
                    )}
                  >
                    <Link
                      href={subItem.href}
                      onClick={() => handleNavigationClick(subItem.href)}
                      {...getHoverPrefetchHandlers(subItem.href)}
                    >
                      <subItem.icon className={iconSizes.sm} />
                      <span>{translateTitle(subItem.title)}</span>
                      {subItem.warningDot && (
                        <span
                          className="ml-auto h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--text-warning))]"
                          aria-hidden
                        />
                      )}
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
              {reveal !== undefined && hiddenHereCount(reveal, item.href) > 0 && (
                <SidebarMenuSubItem>
                  <SidebarHiddenRow
                    count={hiddenHereCount(reveal, item.href)}
                    onReveal={reveal.onReveal}
                  />
                </SidebarMenuSubItem>
              )}
            </SidebarMenuSub>
          )}
        </>
      ) : (
        <SidebarMenuButton
          asChild
          isActive={isActive}
          className={cn(
            `group relative ${TRANSITION_PRESETS.FAST_ALL}`,
            isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
            demotedClass(reveal, item.href)
          )}
        >
          <Link
            href={item.href}
            onClick={() => handleNavigationClick(item.href)}
            {...getHoverPrefetchHandlers(item.href)}
          >
            <SidebarItemLabel item={item} isActive={isActive} title={translateTitle(item.title)} />
          </Link>
        </SidebarMenuButton>
      )}
    </SidebarMenuItemPrimitive>
  );
}
