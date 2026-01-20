'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { BuildingBadge } from '@/core/badges';
import { Eye } from 'lucide-react';
// 🏢 ENTERPRISE: Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { EntityDetailsHeader } from '@/core/entity-headers';
import { cn } from '@/lib/utils';
import type { Building } from '../BuildingsPageContent';
// 🏢 ENTERPRISE: Status display uses centralized BuildingBadge component (no hardcoded functions)
import { GRADIENT_HOVER_EFFECTS } from '@/components/ui/effects';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';


interface BuildingDetailsHeaderProps {
    building: Building;
}

export function BuildingDetailsHeader({ building }: BuildingDetailsHeaderProps) {
    // 🏢 ENTERPRISE: i18n hook for translations with namespace readiness check
    const { t, isNamespaceReady } = useTranslation('building');

    return (
        <>
            {/* 🖥️ DESKTOP: Show full header with actions */}
            <div className="hidden md:block">
                <EntityDetailsHeader
                    icon={NAVIGATION_ENTITIES.building.icon}
                    title={building.name}
                    actions={[
                        {
                            // 🏢 ENTERPRISE: Fallback when namespace not ready
                            label: isNamespaceReady ? t('details.viewBuilding') : 'View Building',
                            onClick: () => console.log('Show building details'),
                            icon: Eye,
                            className: GRADIENT_HOVER_EFFECTS.PRIMARY_BUTTON
                        }
                    ]}
                    variant="detailed"
                />
            </div>

            {/* 📱 MOBILE: Hidden (no header duplication) */}
        </>
    );
}