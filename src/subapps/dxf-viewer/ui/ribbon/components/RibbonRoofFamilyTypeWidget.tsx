'use client';

/**
 * ADR-417 §10 #3 — contextual Roof «Family Type» selector widget. Roof analogue
 * of `RibbonSlabFamilyTypeWidget`.
 *
 * Surfaces on the roof contextual tab when a roof is selected. Lets the user:
 *   - pick / change the roof's family type (assign, «type always wins»),
 *   - open the full «Edit Roof Type» dialog (layers + live 3D preview) — built-ins
 *     Duplicate-to-edit first (Revit «a copy will be made»),
 *   - delete a (user) type (warn → detach → delete, single undo).
 *
 * All mutations route through `useRoofFamilyTypeController` (SSoT). Per-instance
 * overrides live in the sibling `RibbonRoofTypePropertiesWidget`. Self-hides for
 * non-roof selections.
 *
 * @see ../hooks/useRoofFamilyTypeController.ts
 * @see ./RibbonSlabFamilyTypeWidget.tsx — the slab sibling
 * @see ./RibbonRoofTypePropertiesWidget.tsx — sibling override editor
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
import { useRoofFamilyTypeController } from '../hooks/useRoofFamilyTypeController';
import { isBuiltInType, resolveTypeDisplayName } from '../../../bim/family-types/family-type-ui-helpers';
import { openEditRoofType } from '../../../bim/family-types/edit-roof-type-store';

export function RibbonRoofFamilyTypeWidget(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const ctrl = useRoofFamilyTypeController();
  const { roof, roofTypes, currentType, canWrite } = ctrl;

  // Open the full Edit-Type dialog. Built-ins → clone-to-edit first.
  const onEditType = useCallback(async () => {
    if (!currentType) return;
    if (isBuiltInType(currentType)) {
      const baseName = resolveTypeDisplayName(currentType, t);
      const newId = await ctrl.duplicateCurrent(
        `${baseName} ${t('ribbon.commands.roofFamilyType.duplicateNamePrefix')}`,
      );
      if (newId) openEditRoofType(newId);
    } else {
      openEditRoofType(currentType.id);
    }
  }, [ctrl, currentType, t]);

  if (!roof) return null;

  const editable = currentType && !isBuiltInType(currentType) && canWrite;

  return (
    <span className="dxf-ribbon-combobox-row flex-col items-start gap-1">
      <span className="flex items-center gap-1">
        <span className="dxf-ribbon-combobox-label">
          {t('ribbon.commands.roofFamilyType.type')}
        </span>
        <Select
          value={currentType?.id ?? SELECT_CLEAR_VALUE}
          onValueChange={(v) => ctrl.assignType(v === SELECT_CLEAR_VALUE ? undefined : v)}
        >
          <SelectTrigger size="sm" aria-label={t('ribbon.commands.roofFamilyType.type')}>
            <SelectValue placeholder={t('ribbon.commands.roofFamilyType.typeNone')} />
          </SelectTrigger>
          <SelectContent className="w-auto min-w-[11rem]">
            <SelectItem value={SELECT_CLEAR_VALUE}>
              {t('ribbon.commands.roofFamilyType.typeNone')}
            </SelectItem>
            {roofTypes.map((type) => (
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
              ? t('ribbon.commands.roofFamilyType.duplicateAndEdit')
              : t('ribbon.commands.roofFamilyType.editType')}
          </button>
          {editable && (
            <button
              type="button"
              className="text-xs px-1.5 py-0.5 rounded border border-destructive/40 text-destructive hover:bg-destructive/10 whitespace-nowrap"
              onClick={() => void ctrl.deleteType(currentType.id)}
            >
              {t('ribbon.commands.roofFamilyType.deleteType')}
            </button>
          )}
        </span>
      )}
    </span>
  );
}
