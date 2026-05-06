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
}

export function SidebarMenuItem({
  item,
  isExpanded,
  isActive,
  onToggleExpanded,
}: SidebarMenuItemProps) {
  const { state, isMobile, setOpenMobile } = useSidebar();
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

  const handleNavigationClick = () => {
    if (isMobile) setOpenMobile(false);
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
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
              onMouseEnter={openPopover}
              onMouseLeave={closePopover}
            >
              <item.icon
                className={cn(
                  TRANSITION_PRESETS.STANDARD_ALL,
                  isActive && "text-blue-600 dark:text-blue-400" // eslint-disable-line design-system/enforce-semantic-colors
                )}
              />
              {hasChildWarning && (
                <span
                  className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-500" // eslint-disable-line design-system/enforce-semantic-colors
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
                  onClick={() => { setPopoverOpen(false); handleNavigationClick(); }}
                  {...getHoverPrefetchHandlers(subItem.href)}
                  className={cn(
                    "flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                    "hover:bg-accent hover:text-accent-foreground",
                    TRANSITION_PRESETS.FAST_ALL
                  )}
                >
                  <subItem.icon className={iconSizes.sm} />
                  <span>{translateTitle(subItem.title)}</span>
                  {subItem.warningDot && (
                    <span
                      className="ml-auto h-2 w-2 shrink-0 rounded-full bg-amber-500" // eslint-disable-line design-system/enforce-semantic-colors
                      aria-hidden
                    />
                  )}
                </Link>
              ))}
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
                  onClick={handleNavigationClick}
                  {...getHoverPrefetchHandlers(item.href)}
                >
                  <item.icon
                    className={cn(
                      TRANSITION_PRESETS.STANDARD_ALL,
                      isActive && "text-blue-600 dark:text-blue-400" // eslint-disable-line design-system/enforce-semantic-colors
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
              isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
            )}
          >
            <item.icon
              className={cn(
                TRANSITION_PRESETS.STANDARD_ALL,
                isActive && "text-blue-600 dark:text-blue-400" // eslint-disable-line design-system/enforce-semantic-colors
              )}
            />
            <span className="font-medium">{translateTitle(item.title)}</span>
            {item.badge && <SidebarBadge badge={item.badge} />}
            {hasChildWarning && (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-amber-500" // eslint-disable-line design-system/enforce-semantic-colors
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
                      isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                    )}
                  >
                    <Link
                      href={subItem.href}
                      onClick={handleNavigationClick}
                      {...getHoverPrefetchHandlers(subItem.href)}
                    >
                      <subItem.icon className={iconSizes.sm} />
                      <span>{translateTitle(subItem.title)}</span>
                      {subItem.warningDot && (
                        <span
                          className="ml-auto h-2 w-2 shrink-0 rounded-full bg-amber-500" // eslint-disable-line design-system/enforce-semantic-colors
                          aria-hidden
                        />
                      )}
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
          <Link
            href={item.href}
            onClick={handleNavigationClick}
            {...getHoverPrefetchHandlers(item.href)}
          >
            <item.icon
              className={cn(
                TRANSITION_PRESETS.STANDARD_ALL,
                isActive && "text-blue-600 dark:text-blue-400" // eslint-disable-line design-system/enforce-semantic-colors
              )}
            />
            <span className="font-medium">{translateTitle(item.title)}</span>
            {item.badge && <SidebarBadge badge={item.badge} />}
          </Link>
        </SidebarMenuButton>
      )}
    </SidebarMenuItemPrimitive>
  );
}
