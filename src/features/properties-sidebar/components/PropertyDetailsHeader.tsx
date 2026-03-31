// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import type { Property } from '@/types/property-viewer';
import '@/lib/design-system';

// 🏢 ENTERPRISE: Centralized Unit Icon & Color
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;

interface PropertyDetailsHeaderProps {
  unit: Property | null;
  /** 🏢 ENTERPRISE: Edit mode state - Pattern A (entity header) */
  isEditMode?: boolean;
  /** Whether we are creating a new unit (inline form) */
  isCreatingNewUnit?: boolean;
  /** 🏢 ENTERPRISE: Toggle edit mode callback (enters edit mode) */
  onToggleEditMode?: () => void;
  /** 🏢 ENTERPRISE: Exit edit mode callback (cancel without save) */
  onExitEditMode?: () => void;
  /** Callback for creating a new unit */
  onNewUnit?: () => void;
  /** Callback for deleting the current unit */
  onDeleteUnit?: () => void;
}

export function PropertyDetailsHeader({
  unit,
  isEditMode = false,
  isCreatingNewUnit = false,
  onToggleEditMode,
  onExitEditMode,
  onNewUnit,
  onDeleteUnit,
}: PropertyDetailsHeaderProps) {
  const { t } = useTranslation('properties');

  // 🏢 ENTERPRISE: Header Save — programmatically submits the PropertyFieldsBlock form
  const handleHeaderSave = useCallback(() => {
    const form = document.getElementById('property-fields-form') as HTMLFormElement | null;
    if (form) {
      form.requestSubmit();
    } else {
      // Fallback: just exit edit mode if form not found
      onExitEditMode?.();
    }
  }, [onExitEditMode]);

  // 🏢 ENTERPRISE: Header Cancel — exits edit mode (form resets via onExitEditMode)
  const handleHeaderCancel = useCallback(() => {
    onExitEditMode?.();
  }, [onExitEditMode]);

  // Empty State - No unit selected
  if (!unit) {
    return (
      <div className="hidden md:block">
        <EntityDetailsHeader
          icon={UnitIcon}
          title={t('details.selectUnit')}
          subtitle={t('details.noUnitSelected')}
          variant="detailed"
          className="h-[81px] flex items-center"
        />
      </div>
    );
  }

  // 🏢 ENTERPRISE: Actions via centralized presets
  // Creating mode: Δημιουργία (🟢), Cancel (⚪)
  // Edit mode: Save (🟢), Cancel (⚪)
  // Normal mode: Edit (🔵), Νέα Μονάδα (🟢), Διαγραφή (🔴)
  const actions = isEditMode
    ? [
        createEntityAction(
          'save',
          isCreatingNewUnit
            ? t('navigation.actions.newUnit.create', { defaultValue: 'Δημιουργία' })
            : t('buildingSelector.save', { defaultValue: 'Αποθήκευση' }),
          handleHeaderSave
        ),
        createEntityAction('cancel', t('dialog.cancel', { ns: 'common', defaultValue: 'Ακύρωση' }), handleHeaderCancel),
      ]
    : [
        createEntityAction('edit', t('navigation.actions.edit.label', { defaultValue: 'Επεξεργασία' }), () => onToggleEditMode?.()),
        createEntityAction('new', t('navigation.actions.newUnit.label', { defaultValue: 'Νέα Μονάδα' }), () => onNewUnit?.()),
        createEntityAction('delete', t('navigation.actions.delete.label', { defaultValue: 'Διαγραφή' }), () => onDeleteUnit?.()),
      ];

  // Selected State - Unit is selected (or creating new)
  const headerTitle = isCreatingNewUnit
    ? t('navigation.actions.newUnit.label', { defaultValue: 'Νέα Μονάδα' })
    : unit.name;

  return (
    <>
      {/* 🖥️ DESKTOP: Show full header with actions */}
      <div className="hidden md:block">
        <EntityDetailsHeader
          icon={UnitIcon}
          title={headerTitle}
          actions={actions}
          variant="detailed"
        />
      </div>

      {/* 📱 MOBILE: Hidden (no header duplication) */}
    </>
  );
}
