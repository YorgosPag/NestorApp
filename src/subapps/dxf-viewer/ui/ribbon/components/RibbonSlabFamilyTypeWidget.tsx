'use client';

/**
 * ADR-412 — contextual Slab «Family Type» ribbon widget.
 *
 * Thin binding of the shared `FamilyTypeEditorWidget` (ADR-603 Φ4): resolves the
 * slab i18n labels (static keys → CHECK 3.13 safe) and wires the slab controller +
 * `openEditSlabType` store. All mutations route through `useSlabFamilyTypeController`
 * (SSoT). Self-hides for non-slab selections.
 *
 * @see ./FamilyTypeEditorWidget.tsx — shared widget (ADR-603)
 * @see ../hooks/useSlabFamilyTypeController.ts
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSlabFamilyTypeController } from '../hooks/useSlabFamilyTypeController';
import { resolveTypeDisplayName } from '../../../bim/family-types/family-type-ui-helpers';
import { openEditSlabType } from '../../../bim/family-types/edit-slab-type-store';
import { FamilyTypeEditorWidget } from './FamilyTypeEditorWidget';

export function RibbonSlabFamilyTypeWidget(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const ctrl = useSlabFamilyTypeController();

  return (
    <FamilyTypeEditorWidget
      visible={!!ctrl.slab}
      types={ctrl.slabTypes}
      currentType={ctrl.currentType}
      canWrite={ctrl.canWrite}
      assignType={ctrl.assignType}
      duplicateCurrent={ctrl.duplicateCurrent}
      deleteType={ctrl.deleteType}
      openEditType={openEditSlabType}
      resolveDisplayName={(type) => resolveTypeDisplayName(type, t)}
      labels={{
        type: t('ribbon.commands.slabFamilyType.type'),
        typeNone: t('ribbon.commands.slabFamilyType.typeNone'),
        duplicateNamePrefix: t('ribbon.commands.slabFamilyType.duplicateNamePrefix'),
        duplicateAndEdit: t('ribbon.commands.slabFamilyType.duplicateAndEdit'),
        editType: t('ribbon.commands.slabFamilyType.editType'),
        deleteType: t('ribbon.commands.slabFamilyType.deleteType'),
      }}
    />
  );
}
