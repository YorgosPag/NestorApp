"use client"

import * as React from "react"
import { useIconSizes } from '@/hooks/useIconSizes'
import {
    Sidebar,
    SidebarContent,
    SidebarHeader,
    SidebarRail,
} from "@/components/ui/sidebar"
import { SidebarLogo } from "@/components/sidebar/sidebar-logo"
import { SidebarMenuSection } from "@/components/sidebar/sidebar-menu-section"
// 🗑️ REMOVED (2026-01-11): SidebarUserFooter - User management moved to header dropdown only
import { mainMenuItems, toolsMenuItems, settingsMenuItem } from "@/config/navigation"
import { useSidebarState } from "@/hooks/useSidebarState"
import { useTranslationLazy } from "@/i18n/hooks/useTranslationLazy"
import { MapPin } from "lucide-react"
import { useSidebar } from "@/components/ui/sidebar"
import { HOVER_TEXT_EFFECTS, HOVER_BACKGROUND_EFFECTS, TRANSITION_PRESETS } from "@/components/ui/effects"

export function AppSidebar() {
  const iconSizes = useIconSizes()
    const { expandedItems, toggleExpanded, isItemActive } = useSidebarState()
    const { t, isLoading } = useTranslationLazy('navigation')
    const { isMobile, setOpenMobile } = useSidebar()

    // Handle navigation click with mobile sidebar auto-close
    const handleNavigationClick = () => {
        if (isMobile) {
            setOpenMobile(false)
        }
    }

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader className="border-b border-sidebar-border">
                <SidebarLogo />
            </SidebarHeader>

            <SidebarContent>
                <SidebarMenuSection
                    label={isLoading ? 'Main Menu' : t('menu.main')}
                    items={mainMenuItems}
                    expandedItems={expandedItems}
                    onToggleExpanded={toggleExpanded}
                    isItemActive={isItemActive}
                />

                {/* Navigation Link */}
                <div className="px-3 py-2">
                    <a
                        href="/navigation"
                        onClick={handleNavigationClick}
                        className={`flex items-center gap-2 text-gray-700 dark:text-gray-300 py-2 px-1 w-full text-left rounded-md ${HOVER_TEXT_EFFECTS.GRAY} ${HOVER_BACKGROUND_EFFECTS.MUTED} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
                    >
                        <MapPin className={iconSizes.sm} />
                        <span className="font-medium">{isLoading ? 'Navigation' : t('pages.navigation')}</span>
                    </a>
                </div>

                <SidebarMenuSection
                    label={isLoading ? 'Tools' : t('menu.tools')}
                    items={toolsMenuItems}
                    expandedItems={expandedItems}
                    onToggleExpanded={toggleExpanded}
                    isItemActive={isItemActive}
                />

                <SidebarMenuSection
                    items={settingsMenuItem}
                    className="mt-auto"
                    expandedItems={expandedItems}
                    onToggleExpanded={toggleExpanded}
                    isItemActive={isItemActive}
                />
            </SidebarContent>

            {/* 🗑️ REMOVED (2026-01-11): SidebarFooter with user info
                Enterprise pattern: User management handled exclusively via header dropdown */}

            <SidebarRail />
        </Sidebar>
    )
}
