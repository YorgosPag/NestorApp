'use client';

import React from 'react';
import { Eye, Edit, Save, X } from 'lucide-react';
// ENTERPRISE: Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { EntityDetailsHeader, type EntityHeaderAction } from '@/core/entity-headers';
import type { Building } from '../BuildingsPageContent';
// ENTERPRISE: Status display uses centralized BuildingBadge component (no hardcoded functions)
import { GRADIENT_HOVER_EFFECTS } from '@/components/ui/effects';
// ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('BuildingDetailsHeader');


interface BuildingDetailsHeaderProps {
    building: Building;
    /** Whether inline editing is active */
    isEditing: boolean;
    /** Whether a save operation is in progress */
    isSaving: boolean;
    /** Start inline editing on the General tab */
    onStartEdit: () => void;
    /** Trigger save (delegates to GeneralTabContent) */
    onSave: () => void;
    /** Cancel editing and revert changes */
    onCancel: () => void;
}

export function BuildingDetailsHeader({
    building,
    isEditing,
    isSaving,
    onStartEdit,
    onSave,
    onCancel
}: BuildingDetailsHeaderProps) {
    // ENTERPRISE: i18n hook for translations with namespace readiness check
    const { t, isNamespaceReady } = useTranslation('building');

    // ENTERPRISE: Build actions array based on editing state
    const actions: EntityHeaderAction[] = isEditing
        ? [
            {
                label: isSaving
                    ? (isNamespaceReady ? t('details.saving') : 'Saving...')
                    : (isNamespaceReady ? t('details.saveBuilding') : 'Save'),
                onClick: isSaving ? () => {} : onSave,
                icon: Save,
                className: `bg-gradient-to-r from-green-500 to-emerald-600 ${GRADIENT_HOVER_EFFECTS.BLUE_PURPLE_DEEPER}`
            },
            {
                label: isNamespaceReady ? t('details.cancelEdit') : 'Cancel',
                onClick: onCancel,
                icon: X,
                variant: 'outline',
            }
        ]
        : [
            {
                label: isNamespaceReady ? t('details.editBuilding') : 'Edit',
                onClick: onStartEdit,
                icon: Edit,
                className: `bg-gradient-to-r from-amber-500 to-orange-600 ${GRADIENT_HOVER_EFFECTS.BLUE_PURPLE_DEEPER}`
            },
            {
                // ENTERPRISE: Fallback when namespace not ready
                label: isNamespaceReady ? t('details.viewBuilding') : 'View Building',
                onClick: () => logger.info('Show building details'),
                icon: Eye,
                className: GRADIENT_HOVER_EFFECTS.PRIMARY_BUTTON
            }
        ];

    return (
        <>
            {/* DESKTOP: Show full header with actions */}
            <div className="hidden md:block">
                <EntityDetailsHeader
                    icon={NAVIGATION_ENTITIES.building.icon}
                    title={building.name}
                    actions={actions}
                    variant="detailed"
                />
            </div>

            {/* MOBILE: Hidden (no header duplication) */}
        </>
    );
}
