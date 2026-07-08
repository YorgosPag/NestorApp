'use client';

/**
 * ADR-417 §10 #3 — contextual Roof «Family Type» ribbon widget.
 *
 * Thin binding of the shared `FamilyTypeEditorWidget` (ADR-603 Φ4): resolves the
 * roof i18n labels (static keys → CHECK 3.13 safe) and wires the roof controller +
 * `openEditRoofType` store. All mutations route through `useRoofFamilyTypeController`
 * (SSoT). Per-instance overrides live in `RibbonRoofTypePropertiesWidget`.
 * Self-hides for non-roof selections.
 *
 * @see ./FamilyTypeEditorWidget.tsx — shared widget (ADR-603)
 * @see ../hooks/useRoofFamilyTypeController.ts
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useRoofFamilyTypeController } from '../hooks/useRoofFamilyTypeController';
import { resolveTypeDisplayName } from '../../../bim/family-types/family-type-ui-helpers';
import { openEditRoofType } from '../../../bim/family-types/edit-roof-type-store';
import { FamilyTypeEditorWidget } from './FamilyTypeEditorWidget';

export function RibbonRoofFamilyTypeWidget(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const ctrl = useRoofFamilyTypeController();

  return (
    <FamilyTypeEditorWidget
      visible={!!ctrl.roof}
      types={ctrl.roofTypes}
      currentType={ctrl.currentType}
      canWrite={ctrl.canWrite}
      assignType={ctrl.assignType}
      duplicateCurrent={ctrl.duplicateCurrent}
      deleteType={ctrl.deleteType}
      openEditType={openEditRoofType}
      resolveDisplayName={(type) => resolveTypeDisplayName(type, t)}
      labels={{
        type: t('ribbon.commands.roofFamilyType.type'),
        typeNone: t('ribbon.commands.roofFamilyType.typeNone'),
        duplicateNamePrefix: t('ribbon.commands.roofFamilyType.duplicateNamePrefix'),
        duplicateAndEdit: t('ribbon.commands.roofFamilyType.duplicateAndEdit'),
        editType: t('ribbon.commands.roofFamilyType.editType'),
        deleteType: t('ribbon.commands.roofFamilyType.deleteType'),
      }}
    />
  );
}
