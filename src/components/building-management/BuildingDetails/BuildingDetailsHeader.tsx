'use client';

import React from 'react';
// ENTERPRISE: Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
import type { Building } from '../BuildingsPageContent';
// ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';
import { formatBuildingLabel } from '@/lib/entity-formatters';


interface BuildingDetailsHeaderProps {
    building: Building;
    /** Whether inline editing is active */
    isEditing: boolean;
    /** Whether a save operation is in progress */
    isSaving: boolean;
    /** Start inline editing on the General tab — omit to hide the Edit button (e.g. trash mode) */
    onStartEdit?: () => void;
    /** Trigger save (delegates to GeneralTabContent) */
    onSave: () => void;
    /** Cancel editing and revert changes */
    onCancel: () => void;
    /** Create a new building (inline) */
    onNewBuilding?: () => void;
    /** Delete the current building */
    onDeleteBuilding?: () => void;
    /** Open the Building Showcase share dialog (ADR-320) */
    onShowcaseBuilding?: () => void;
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
    onShowcaseBuilding,
}: BuildingDetailsHeaderProps) {
    // 🏢 ENTERPRISE: every namespace below is in CRITICAL_NAMESPACES (lazy-config.ts),
    // so it is resolved before this header can mount. The `isNamespaceReady ? t(…) : 'Save'`
    // guards this file used to carry were a workaround for `showcase` loading lazily —
    // they showed English literals to a Greek user for one frame and violated N.11.
    const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline', 'showcase']);

    // 🏢 ENTERPRISE: Actions via centralized presets
    // Edit mode: Save (🟢), Cancel (⚪)
    // Normal mode: New, Edit, Delete
    const actions = isEditing
        ? [
            createEntityAction(
                'save',
                isSaving ? t('details.saving') : t('details.saveBuilding'),
                isSaving ? () => {} : onSave
            ),
            createEntityAction(
                'cancel',
                t('details.cancelEdit'),
                onCancel
            ),
        ]
        : [
            ...(onShowcaseBuilding ? [createEntityAction(
                'showcase',
                t('showcase:buildingShowcase.actions.showcase'),
                onShowcaseBuilding
            )] : []),
            ...(onNewBuilding ? [createEntityAction(
                'new',
                t('details.newBuilding'),
                onNewBuilding
            )] : []),
            ...(onStartEdit ? [createEntityAction(
                'edit',
                t('details.editBuilding'),
                onStartEdit
            )] : []),
            ...(onDeleteBuilding ? [createEntityAction(
                'delete',
                t('details.deleteBuilding'),
                onDeleteBuilding
            )] : []),
        ];

    return (
        <>
            {/* DESKTOP: Show full header with actions */}
            <div className="hidden md:block">
                <EntityDetailsHeader
                    icon={NAVIGATION_ENTITIES.building.icon}
                    title={formatBuildingLabel(building.code, building.name)}
                    actions={actions}
                    variant="detailed"
                />
            </div>

            {/* MOBILE: Hidden (no header duplication) */}
        </>
    );
}
