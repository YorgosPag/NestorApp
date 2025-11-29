"use client"

import * as React from "react"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarRail,
} from "@/components/ui/sidebar"
import { SidebarLogo } from "@/components/sidebar/sidebar-logo"
import { SidebarMenuSection } from "@/components/sidebar/sidebar-menu-section"
import { SidebarUserFooter } from "@/components/sidebar/sidebar-user-footer"
import { mainMenuItems, toolsMenuItems, settingsMenuItem } from "@/config/navigation"
import { useSidebarState } from "@/hooks/useSidebarState"
import { useTranslationLazy } from "@/i18n/hooks/useTranslationLazy"
import { MapPin } from "lucide-react"

export function AppSidebar() {
    const { expandedItems, toggleExpanded, isItemActive } = useSidebarState()
    const { t, isLoading } = useTranslationLazy('navigation')

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
                        className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors py-2 px-1 w-full text-left rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                        <MapPin className="h-4 w-4" />
                        <span className="font-medium">Πλοήγηση</span>
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

            <SidebarFooter className="border-t border-sidebar-border">
                <SidebarUserFooter />
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    )
}
