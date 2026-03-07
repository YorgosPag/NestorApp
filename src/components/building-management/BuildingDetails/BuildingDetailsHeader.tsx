'use client';

import React from 'react';
// ENTERPRISE: Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
import type { Building } from '../BuildingsPageContent';
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

    // 🏢 ENTERPRISE: Actions via centralized presets
    // Edit mode: Save (🟢), Cancel (⚪)
    // Normal mode: Edit (🔵), View (🔵 primary)
    const actions = isEditing
        ? [
            createEntityAction(
                'save',
                isSaving
                    ? (isNamespaceReady ? t('details.saving') : 'Saving...')
                    : (isNamespaceReady ? t('details.saveBuilding') : 'Save'),
                isSaving ? () => {} : onSave
            ),
            createEntityAction(
                'cancel',
                isNamespaceReady ? t('details.cancelEdit') : 'Cancel',
                onCancel
            ),
        ]
        : [
            createEntityAction(
                'edit',
                isNamespaceReady ? t('details.editBuilding') : 'Edit',
                onStartEdit
            ),
            createEntityAction(
                'view',
                isNamespaceReady ? t('details.viewBuilding') : 'View Building',
                () => logger.info('Show building details')
            ),
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
