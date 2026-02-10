'use client';

import React from 'react';
import { Eye, Edit } from 'lucide-react';
// 🏢 ENTERPRISE: Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { EntityDetailsHeader, type EntityHeaderAction } from '@/core/entity-headers';
import type { Building } from '../BuildingsPageContent';
// 🏢 ENTERPRISE: Status display uses centralized BuildingBadge component (no hardcoded functions)
import { GRADIENT_HOVER_EFFECTS } from '@/components/ui/effects';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('BuildingDetailsHeader');


interface BuildingDetailsHeaderProps {
    building: Building;
    /** 🏢 ENTERPRISE: Callback for edit button (ADR-087) */
    onEdit?: () => void;
}

export function BuildingDetailsHeader({ building, onEdit }: BuildingDetailsHeaderProps) {
    // 🏢 ENTERPRISE: i18n hook for translations with namespace readiness check
    const { t, isNamespaceReady } = useTranslation('building');

    // 🏢 ENTERPRISE: Build actions array dynamically (ADR-087)
    const actions: EntityHeaderAction[] = [
        {
            // 🏢 ENTERPRISE: Fallback when namespace not ready
            label: isNamespaceReady ? t('details.viewBuilding') : 'View Building',
            onClick: () => logger.info('Show building details'),
            icon: Eye,
            className: GRADIENT_HOVER_EFFECTS.PRIMARY_BUTTON
        }
    ];

    // 🏢 ENTERPRISE: Add edit action if callback provided (ADR-087)
    if (onEdit) {
        actions.unshift({
            label: isNamespaceReady ? t('details.editBuilding') : 'Edit',
            onClick: onEdit,
            icon: Edit,
            className: `bg-gradient-to-r from-amber-500 to-orange-600 ${GRADIENT_HOVER_EFFECTS.BLUE_PURPLE_DEEPER}`
        });
    }

    return (
        <>
            {/* 🖥️ DESKTOP: Show full header with actions */}
            <div className="hidden md:block">
                <EntityDetailsHeader
                    icon={NAVIGATION_ENTITIES.building.icon}
                    title={building.name}
                    actions={actions}
                    variant="detailed"
                />
            </div>

            {/* 📱 MOBILE: Hidden (no header duplication) */}
        </>
    );
}