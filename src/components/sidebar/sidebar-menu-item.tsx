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
  const iconSizes = useIconSizes();
  const { t, isLoading } = useTranslationLazy('navigation');

  // 🏢 ENTERPRISE: Translate menu item title
  // If title contains a dot, it's an i18n key - translate it
  // Otherwise, return as-is (for fallback/legacy items)
  const translateTitle = (title: string): string => {
    if (isLoading) return title;
    if (title.includes('.')) {
      const translated = t(title);
      // If translation returns the key itself, return original title
      return translated === title ? title : translated;
    }
    return title;
  };

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
            <span className="font-medium">{translateTitle(item.title)}</span>
            {item.badge && <SidebarBadge badge={item.badge} />}
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
                    <Link href={subItem.href} onClick={handleNavigationClick}>
                      <subItem.icon className={iconSizes.sm} />
                      <span>{translateTitle(subItem.title)}</span>
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
            <span className="font-medium">{translateTitle(item.title)}</span>
            {item.badge && <SidebarBadge badge={item.badge} />}
          </Link>
        </SidebarMenuButton>
      )}
    </SidebarMenuItemPrimitive>
  )
}
