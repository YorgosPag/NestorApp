"use client"

import * as React from "react"
import { useIconSizes } from '@/hooks/useIconSizes'
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarRail,
} from "@/components/ui/sidebar"
import { SidebarLogo } from "@/components/sidebar/sidebar-logo"
import { SidebarMenuSection } from "@/components/sidebar/sidebar-menu-section"
// 🗑️ REMOVED (2026-01-11): SidebarUserFooter - User management moved to header dropdown only
import { useJobFilteredNavigation } from "@/hooks/useJobFilteredNavigation"
import { useSidebarState } from "@/hooks/useSidebarState"
import { useBuildingsNoUnits } from "@/contexts/BuildingsNoUnitsContext"
import { useTranslationLazy } from "@/i18n/hooks/useTranslationLazy"
import { MapPin } from "lucide-react"
import { useSidebar } from "@/components/ui/sidebar"
import { HOVER_TEXT_EFFECTS, HOVER_BACKGROUND_EFFECTS, TRANSITION_PRESETS } from "@/components/ui/effects"
import '@/lib/design-system';

export function AppSidebar() {
  const iconSizes = useIconSizes()
    const { expandedItems, toggleExpanded, isItemActive } = useSidebarState()
    const { t } = useTranslationLazy('navigation')
    const { isMobile, setOpenMobile } = useSidebar()

    // 🏢 ADR-748 Φάση 3: τα δύο διαδοχικά φίλτρα (δικαίωμα → ενεργή δουλειά)
    // ζουν πλέον σε ΕΝΑΝ hook, κοινό με τον διακόπτη δουλειάς του header ώστε
    // ο δείκτης «Χ κρυμμένα» να μετρά ό,τι ακριβώς λείπει από εδώ.
    // (Ο inline υπολογισμός permissions που ζούσε εδώ μετακόμισε αυτούσιος στο
    //  `useEffectivePermissions` — ήταν ο μόνος του είδους του και η Φάση 3 του
    //  πρόσθετε δύο ακόμη καταναλωτές.)
    const {
        mainMenuItems: jobFilteredMainItems,
        toolsMenuItems,
        settingsMenuItems,
    } = useJobFilteredNavigation()
    const hasBuildingsWithNoUnits = useBuildingsNoUnits();

    const mainMenuItems = React.useMemo(
        () => {
            if (!hasBuildingsWithNoUnits) return jobFilteredMainItems;
            return jobFilteredMainItems.map(item => {
                if (!item.subItems) return item;
                return {
                    ...item,
                    subItems: item.subItems.map(sub =>
                        sub.href === '/spaces/properties'
                            ? { ...sub, warningDot: true }
                            : sub
                    ),
                };
            });
        },
        [jobFilteredMainItems, hasBuildingsWithNoUnits]
    )

    // Handle navigation click with mobile sidebar auto-close
    const handleNavigationClick = () => {
        if (isMobile) {
            setOpenMobile(false)
        }
    }

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
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

                {/* Navigation Link */}
                <div className="px-3 py-2">
                    <a
                        href="/navigation"
                        onClick={handleNavigationClick}
                        className={`flex items-center gap-2 text-foreground py-2 px-1 w-full text-left rounded-md ${HOVER_TEXT_EFFECTS.GRAY} ${HOVER_BACKGROUND_EFFECTS.MUTED} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
                    >
                        <MapPin className={iconSizes.sm} />
                        <span className="font-medium">{t('pages.navigation')}</span>
                    </a>
                </div>

                <SidebarMenuSection
                    label={t('menu.tools')}
                    items={toolsMenuItems}
                    expandedItems={expandedItems}
                    onToggleExpanded={toggleExpanded}
                    isItemActive={isItemActive}
                />

                <SidebarMenuSection
                    items={settingsMenuItems}
                    className="mt-auto"
                    expandedItems={expandedItems}
                    onToggleExpanded={toggleExpanded}
                    isItemActive={isItemActive}
                />
            </SidebarContent>

            <SidebarFooter className="border-t border-sidebar-border">
                <nav aria-label={t('legal.legalLinks')} className="flex flex-wrap gap-x-4 gap-y-1 px-2 py-1.5 text-xs text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
                    <a href="/privacy-policy" className="hover:underline hover:text-sidebar-foreground min-h-[24px] min-w-[24px] px-0.5 py-0.5 inline-flex items-center transition-colors">{t('legal.privacyPolicy')}</a>
                    <a href="/terms" className="hover:underline hover:text-sidebar-foreground min-h-[24px] min-w-[24px] px-0.5 py-0.5 inline-flex items-center transition-colors">{t('legal.termsOfService')}</a>
                    <a href="/data-deletion" className="hover:underline hover:text-sidebar-foreground min-h-[24px] min-w-[24px] px-0.5 py-0.5 inline-flex items-center transition-colors">{t('legal.dataDeletion')}</a>
                </nav>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    )
}
