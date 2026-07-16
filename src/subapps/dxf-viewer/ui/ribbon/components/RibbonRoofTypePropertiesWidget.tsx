'use client';

/**
 * ADR-417 §10 #3 — Roof Type Properties + per-parameter override editor. Roof
 * analogue of `RibbonWallTypePropertiesWidget`.
 *
 * Surfaces the EFFECTIVE («type-resolved») type-governed params of the selected
 * typed roof and lets a single instance deviate per-parameter (Revit «by-instance»).
 * A roof has no sub-kind, so `material` is the only overridable param; `thickness`
 * (DNA-governed) is read-only — edited on the type itself via the Edit-Type dialog.
 * Overridden material carries a badge; «Reset to type» clears every override.
 * User types are renamable inline; built-ins are read-only.
 *
 * All mutations route through `useRoofFamilyTypeController` (SSoT). The shared chrome
 * (header / rename / badges) comes from `family-type-properties-parts` + the
 * `useFamilyTypeEditor` hook — this widget owns ONLY the roof params.
 *
 * ⚠️ NO `FamilyTypeActions` here, unlike the wall sibling: Edit/Delete for roofs live
 * in `RibbonRoofFamilyTypeWidget` (the selector). Adding them would double the buttons.
 * `openEditRoofType` is still handed to the editor so «clone-to-edit» stays wired if a
 * future footer needs it.
 *
 * @see ../hooks/useRoofFamilyTypeController.ts
 * @see ./RibbonWallTypePropertiesWidget.tsx — the wall sibling
 * @see ./RibbonRoofFamilyTypeWidget.tsx — sibling selector (edit/delete)
 */

import React from 'react';
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
import { useFamilyTypeEditor } from '../hooks/useFamilyTypeEditor';
import { openEditRoofType } from '../../../bim/family-types/edit-roof-type-store';
import {
  FamilyTypeOverrideBadge,
  FamilyTypePropertiesHeader,
  FamilyTypeThicknessRow,
} from './family-type-properties-parts';

/** Roof-level material value → i18n key suffix (mirror the Edit dialog list). */
const MATERIAL_OPTIONS: readonly { value: string; key: string }[] = [
  { value: 'rc', key: 'rc' },
  { value: 'tile', key: 'tile' },
  { value: 'wood', key: 'wood' },
] as const;

export function RibbonRoofTypePropertiesWidget(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const ctrl = useRoofFamilyTypeController();
  const { roof, currentType, overriddenKeys } = ctrl;
  const editor = useFamilyTypeEditor(ctrl, openEditRoofType);

  if (!roof || !currentType) return null;

  const materialOverridden = overriddenKeys.includes('material');

  return (
    <span className="dxf-ribbon-combobox-row flex-col items-start gap-1">
      <FamilyTypePropertiesHeader ctrl={ctrl} editor={editor} />

      <span className="flex items-center gap-1">
        <span className="dxf-ribbon-combobox-label">
          {t('ribbon.commands.bimFamilyType.paramMaterial')}
        </span>
        <Select
          value={roof.params.material ?? SELECT_CLEAR_VALUE}
          onValueChange={(v) =>
            ctrl.setOverride('material', v === SELECT_CLEAR_VALUE ? undefined : v)
          }
        >
          <SelectTrigger size="sm" aria-label={t('ribbon.commands.bimFamilyType.paramMaterial')}>
            <SelectValue placeholder={t('ribbon.commands.bimFamilyType.materialNone')} />
          </SelectTrigger>
          <SelectContent className="w-auto min-w-[9rem]">
            <SelectItem value={SELECT_CLEAR_VALUE}>
              {t('ribbon.commands.bimFamilyType.materialNone')}
            </SelectItem>
            {MATERIAL_OPTIONS.map((m) => (
              <SelectItem key={m.value} value={m.value} className="whitespace-nowrap">
                {t(`ribbon.commands.roofFamilyType.material.${m.key}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {materialOverridden && (
          <FamilyTypeOverrideBadge onClear={() => ctrl.clearOverride('material')} />
        )}
      </span>

      <FamilyTypeThicknessRow thicknessMm={roof.params.thickness} />
    </span>
  );
}
