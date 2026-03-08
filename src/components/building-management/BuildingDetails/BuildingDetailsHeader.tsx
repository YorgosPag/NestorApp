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
    /** Create a new building (inline) */
    onNewBuilding?: () => void;
    /** Delete the current building */
    onDeleteBuilding?: () => void;
}

export function BuildingDetailsHeader({
    building,
    isEditing,
    isSaving,
    onStartEdit,
    onSave,
    onCancel,
    onNewBuilding,
    onDeleteBuilding,
}: BuildingDetailsHeaderProps) {
    // ENTERPRISE: i18n hook for translations with namespace readiness check
    const { t, isNamespaceReady } = useTranslation('building');

    // 🏢 ENTERPRISE: Actions via centralized presets
    // Edit mode: Save (🟢), Cancel (⚪)
    // Normal mode: New, Edit, Delete
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
            ...(onNewBuilding ? [createEntityAction(
                'new',
                isNamespaceReady ? t('details.newBuilding') : 'New',
                onNewBuilding
            )] : []),
            createEntityAction(
                'edit',
                isNamespaceReady ? t('details.editBuilding') : 'Edit',
                onStartEdit
            ),
            ...(onDeleteBuilding ? [createEntityAction(
                'delete',
                isNamespaceReady ? t('details.deleteBuilding') : 'Delete',
                onDeleteBuilding
            )] : []),
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
