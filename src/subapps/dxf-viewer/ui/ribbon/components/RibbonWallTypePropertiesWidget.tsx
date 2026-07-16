'use client';

/**
 * ADR-412 Φ4 — Wall Type Properties + per-parameter override editor.
 *
 * Surfaces the EFFECTIVE («type-resolved») type-governed params of the selected
 * typed wall and lets a single instance deviate per-parameter (Vectorworks
 * «by-style / by-instance», Q4). Overridden params carry a badge; «Reset to type»
 * clears every override (Revit). User types are renamable inline; built-ins are
 * read-only (clone-to-edit via the sibling selector's «Duplicate»).
 *
 * Φ4 exposes `category` as the overridable param (always defined → no
 * none-ambiguity); `thickness`/`material` are shown read-only (structural / DNA-
 * governed — edited on the type itself). All mutations route through
 * `useWallFamilyTypeController` (SSoT). Self-hides for untyped/ad-hoc walls. The
 * shared chrome (header / badges / actions) comes from `family-type-properties-parts`.
 *
 * @see ../hooks/useWallFamilyTypeController.ts
 * @see ./RibbonWallFamilyTypeWidget.tsx — sibling selector
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useWallFamilyTypeController } from '../hooks/useWallFamilyTypeController';
import { useFamilyTypeEditor } from '../hooks/useFamilyTypeEditor';
import { openEditWallType } from '../../../bim/family-types/edit-wall-type-store';
import type { WallCategory } from '../../../bim/types/wall-types';
import { computeWallTypeUValue } from '../../../bim/thermal/wall-assembly-thermal';
import {
  FamilyTypeActions,
  FamilyTypeOverrideBadge,
  FamilyTypePropertiesHeader,
} from './family-type-properties-parts';

const CATEGORY_VALUES: readonly WallCategory[] = [
  'exterior',
  'interior',
  'partition',
  'parapet',
  'fence',
] as const;

/** Material value → i18n key suffix (handles the hyphenated `aerated-concrete`). */
const MATERIAL_KEY: Record<string, string> = {
  rc: 'rc',
  masonry: 'masonry',
  'aerated-concrete': 'aeratedConcrete',
  gypsum: 'gypsum',
};

export function RibbonWallTypePropertiesWidget(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const ctrl = useWallFamilyTypeController();
  const { wall, currentType, overriddenKeys } = ctrl;
  const editor = useFamilyTypeEditor(ctrl, openEditWallType);

  if (!wall || !currentType) return null;

  const categoryOverridden = overriddenKeys.includes('category');
  const materialLabel = wall.params.material
    ? t(`ribbon.commands.wallEditor.material.${MATERIAL_KEY[wall.params.material] ?? 'rc'}`)
    : t('ribbon.commands.bimFamilyType.materialNone');

  return (
    <span className="dxf-ribbon-combobox-row flex-col items-start gap-1">
      <FamilyTypePropertiesHeader ctrl={ctrl} editor={editor} />

      <span className="flex items-center gap-1">
        <span className="dxf-ribbon-combobox-label">
          {t('ribbon.commands.bimFamilyType.paramCategory')}
        </span>
        <Select
          value={wall.params.category}
          onValueChange={(v) => ctrl.setOverride('category', v as WallCategory)}
        >
          <SelectTrigger size="sm" aria-label={t('ribbon.commands.bimFamilyType.paramCategory')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="w-auto min-w-[9rem]">
            {CATEGORY_VALUES.map((c) => (
              <SelectItem key={c} value={c} className="whitespace-nowrap">
                {t(`ribbon.commands.wallEditor.category.${c}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {categoryOverridden && (
          <FamilyTypeOverrideBadge onClear={() => ctrl.clearOverride('category')} />
        )}
      </span>

      <span className="flex items-center gap-2 text-xs">
        <span className="dxf-ribbon-combobox-label">
          {t('ribbon.commands.bimFamilyType.paramThickness')}
        </span>
        <span className="dxf-ribbon-wall-length-value">
          {Math.round(wall.params.thickness)} {t('ribbon.commands.bimFamilyType.thicknessUnit')}
        </span>
        <span className="dxf-ribbon-combobox-label">
          {t('ribbon.commands.bimFamilyType.paramMaterial')}
        </span>
        <span className="dxf-ribbon-wall-length-value">{materialLabel}</span>
      </span>

      {wall.params.dna && (() => {
        const u = computeWallTypeUValue(wall.params.dna);
        return (
          <span className="flex items-center gap-2 text-xs">
            <span className="dxf-ribbon-combobox-label">
              {t('ribbon.commands.bimFamilyType.paramUValue')}
            </span>
            <span className="dxf-ribbon-wall-length-value font-semibold">
              {Number.isFinite(u) ? u.toFixed(2) : '—'} {t('ribbon.commands.bimFamilyType.uValueUnit')}
            </span>
          </span>
        );
      })()}

      <FamilyTypeActions ctrl={ctrl} editor={editor} />
    </span>
  );
}
