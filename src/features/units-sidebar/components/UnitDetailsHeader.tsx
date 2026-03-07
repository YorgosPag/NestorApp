// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import type { Property } from '@/types/property-viewer';

// 🏢 ENTERPRISE: Centralized Unit Icon & Color
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;

interface UnitDetailsHeaderProps {
  unit: Property | null;
  /** 🏢 ENTERPRISE: Edit mode state - Pattern A (entity header) */
  isEditMode?: boolean;
  /** 🏢 ENTERPRISE: Toggle edit mode callback (enters edit mode) */
  onToggleEditMode?: () => void;
  /** 🏢 ENTERPRISE: Exit edit mode callback (cancel without save) */
  onExitEditMode?: () => void;
  /** Callback for creating a new unit */
  onNewUnit?: () => void;
  /** Callback for deleting the current unit */
  onDeleteUnit?: () => void;
}

export function UnitDetailsHeader({
  unit,
  isEditMode = false,
  onToggleEditMode,
  onExitEditMode,
  onNewUnit,
  onDeleteUnit,
}: UnitDetailsHeaderProps) {
  const { t } = useTranslation('units');

  // 🏢 ENTERPRISE: Header Save — programmatically submits the UnitFieldsBlock form
  const handleHeaderSave = useCallback(() => {
    const form = document.getElementById('unit-fields-form') as HTMLFormElement | null;
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
  // Normal mode: Edit (🔵), Νέα Μονάδα (🟢), Διαγραφή (🔴)
  // Edit mode: Save (🟢), Cancel (⚪)
  const actions = isEditMode
    ? [
        createEntityAction('save', t('buildingSelector.save', { defaultValue: 'Αποθήκευση' }), handleHeaderSave),
        createEntityAction('cancel', t('dialog.cancel', { ns: 'common', defaultValue: 'Ακύρωση' }), handleHeaderCancel),
      ]
    : [
        createEntityAction('edit', t('navigation.actions.edit.label', { defaultValue: 'Επεξεργασία' }), () => onToggleEditMode?.()),
        createEntityAction('new', t('navigation.actions.newUnit.label', { defaultValue: 'Νέα Μονάδα' }), () => onNewUnit?.()),
        createEntityAction('delete', t('navigation.actions.delete.label', { defaultValue: 'Διαγραφή' }), () => onDeleteUnit?.()),
      ];

  // Selected State - Unit is selected
  return (
    <>
      {/* 🖥️ DESKTOP: Show full header with actions */}
      <div className="hidden md:block">
        <EntityDetailsHeader
          icon={UnitIcon}
          title={unit.name}
          actions={actions}
          variant="detailed"
        />
      </div>

      {/* 📱 MOBILE: Hidden (no header duplication) */}
    </>
  );
}
