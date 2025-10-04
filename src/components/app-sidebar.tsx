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
import { useTranslation } from "@/i18n"
import { Settings } from "lucide-react"

export function AppSidebar() {
    const { expandedItems, toggleExpanded, isItemActive } = useSidebarState()
    const { t } = useTranslation('navigation')

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader className="border-b border-sidebar-border">
                <SidebarLogo />
            </SidebarHeader>

            <SidebarContent>
                <SidebarMenuSection
                    label={t('menu.main')}
                    items={mainMenuItems}
                    expandedItems={expandedItems}
                    onToggleExpanded={toggleExpanded}
                    isItemActive={isItemActive}
                />

                <SidebarMenuSection
                    label={t('menu.tools')}
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
