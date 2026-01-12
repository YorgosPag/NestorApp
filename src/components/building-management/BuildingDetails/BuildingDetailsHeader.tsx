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
import { getStatusColor, getStatusLabel } from '../BuildingCard/BuildingCardUtils';
import { GRADIENT_HOVER_EFFECTS } from '@/components/ui/effects';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';


interface BuildingDetailsHeaderProps {
    building: Building;
}

export function BuildingDetailsHeader({ building }: BuildingDetailsHeaderProps) {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('building');

    return (
        <>
            {/* 🖥️ DESKTOP: Show full header with actions */}
            <div className="hidden md:block">
                <EntityDetailsHeader
                    icon={NAVIGATION_ENTITIES.building.icon}
                    title={building.name}
                    actions={[
                        {
                            label: t('details.viewBuilding'),
                            onClick: () => console.log('Show building details'),
                            icon: Eye,
                            className: GRADIENT_HOVER_EFFECTS.PRIMARY_BUTTON
                        }
                    ]}
                    variant="detailed"
                >
                    {/* Centralized BuildingBadge Components */}
                    <div className="flex gap-2 mt-2">
                        <BuildingBadge status={building.status} size="sm" />
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-secondary text-secondary-foreground rounded-full">
                            {t('details.percentComplete', { percent: building.progress })}
                        </span>
                    </div>
                </EntityDetailsHeader>
            </div>

            {/* 📱 MOBILE: Hidden (no header duplication) */}
        </>
    );
}