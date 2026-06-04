'use client';

/**
 * ADR-412 — contextual Slab «Family Type» ribbon widget. Slab analogue of
 * `RibbonWallFamilyTypeWidget` + `RibbonWallTypePropertiesWidget` (combined, lean).
 *
 * Surfaces on the slab contextual tab when a slab is selected. Lets the user:
 *   - pick / change the slab's family type (assign, «type always wins»),
 *   - open the full «Edit Slab Type» dialog (layers + live 3D preview) — built-ins
 *     Duplicate-to-edit first (Revit «a copy will be made»),
 *   - delete a (user) type (warn → detach → delete, single undo).
 *
 * All mutations route through `useSlabFamilyTypeController` (SSoT). Self-hides for
 * non-slab selections.
 *
 * @see ../hooks/useSlabFamilyTypeController.ts
 * @see ./RibbonWallTypePropertiesWidget.tsx — the wall sibling
 */

import React, { useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSlabFamilyTypeController } from '../hooks/useSlabFamilyTypeController';
import { isBuiltInType, resolveTypeDisplayName } from '../../../bim/family-types/family-type-ui-helpers';
import { openEditSlabType } from '../../../bim/family-types/edit-slab-type-store';

export function RibbonSlabFamilyTypeWidget(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const ctrl = useSlabFamilyTypeController();
  const { slab, slabTypes, currentType, canWrite } = ctrl;

  // Open the full Edit-Type dialog. Built-ins → clone-to-edit first.
  const onEditType = useCallback(async () => {
    if (!currentType) return;
    if (isBuiltInType(currentType)) {
      const baseName = resolveTypeDisplayName(currentType, t);
      const newId = await ctrl.duplicateCurrent(
        `${baseName} ${t('ribbon.commands.slabFamilyType.duplicateNamePrefix')}`,
      );
      if (newId) openEditSlabType(newId);
    } else {
      openEditSlabType(currentType.id);
    }
  }, [ctrl, currentType, t]);

  if (!slab) return null;

  const editable = currentType && !isBuiltInType(currentType) && canWrite;

  return (
    <span className="dxf-ribbon-combobox-row flex-col items-start gap-1">
      <span className="flex items-center gap-1">
        <span className="dxf-ribbon-combobox-label">
          {t('ribbon.commands.slabFamilyType.type')}
        </span>
        <Select
          value={currentType?.id ?? SELECT_CLEAR_VALUE}
          onValueChange={(v) => ctrl.assignType(v === SELECT_CLEAR_VALUE ? undefined : v)}
        >
          <SelectTrigger size="sm" aria-label={t('ribbon.commands.slabFamilyType.type')}>
            <SelectValue placeholder={t('ribbon.commands.slabFamilyType.typeNone')} />
          </SelectTrigger>
          <SelectContent className="w-auto min-w-[11rem]">
            <SelectItem value={SELECT_CLEAR_VALUE}>
              {t('ribbon.commands.slabFamilyType.typeNone')}
            </SelectItem>
            {slabTypes.map((type) => (
              <SelectItem key={type.id} value={type.id} className="whitespace-nowrap">
                {resolveTypeDisplayName(type, t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </span>

      {currentType && canWrite && (
        <span className="flex items-center gap-1">
          <button
            type="button"
            className="text-xs px-1.5 py-0.5 rounded border border-black/20 hover:bg-black/5 whitespace-nowrap"
            onClick={onEditType}
          >
            {isBuiltInType(currentType)
              ? t('ribbon.commands.slabFamilyType.duplicateAndEdit')
              : t('ribbon.commands.slabFamilyType.editType')}
          </button>
          {editable && (
            <button
              type="button"
              className="text-xs px-1.5 py-0.5 rounded border border-destructive/40 text-destructive hover:bg-destructive/10 whitespace-nowrap"
              onClick={() => void ctrl.deleteType(currentType.id)}
            >
              {t('ribbon.commands.slabFamilyType.deleteType')}
            </button>
          )}
        </span>
      )}
    </span>
  );
}
