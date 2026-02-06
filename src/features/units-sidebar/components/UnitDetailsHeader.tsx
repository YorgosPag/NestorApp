// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Save, X } from 'lucide-react';
import { EntityDetailsHeader } from '@/core/entity-headers';
import { GRADIENT_HOVER_EFFECTS } from '@/components/ui/effects';
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
}

export function UnitDetailsHeader({
  unit,
  isEditMode = false,
  onToggleEditMode,
  onExitEditMode,
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

  // 🏢 ENTERPRISE: Actions change based on edit mode
  // Normal mode: "Επεξεργασία" button
  // Edit mode: "Αποθήκευση" (green) + "Ακύρωση" (outline)
  const actions = isEditMode
    ? [
        {
          label: t('buildingSelector.save', { defaultValue: 'Αποθήκευση' }),
          onClick: handleHeaderSave,
          icon: Save,
          className: 'bg-green-600 hover:bg-green-700 text-white',
        },
        {
          label: t('dialog.cancel', { ns: 'common', defaultValue: 'Ακύρωση' }),
          onClick: handleHeaderCancel,
          icon: X,
          variant: 'outline' as const,
        },
      ]
    : [
        {
          label: t('navigation.actions.edit.label', { defaultValue: 'Επεξεργασία' }),
          onClick: () => onToggleEditMode?.(),
          icon: Pencil,
          className: `bg-gradient-to-r from-amber-500 to-orange-600 ${GRADIENT_HOVER_EFFECTS.BLUE_PURPLE_DEEPER}`,
        },
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
