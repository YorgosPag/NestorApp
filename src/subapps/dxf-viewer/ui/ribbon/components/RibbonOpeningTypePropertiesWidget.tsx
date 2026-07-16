'use client';

/**
 * ADR-421 SLICE C — Opening Type Properties widget (contextual Opening ribbon).
 *
 * Surfaces the EFFECTIVE («type-resolved») type-governed params of the selected
 * typed opening (width / height / frame / glazing / material / fire-rating).
 * Per Revit, dimensions are TYPE-governed → shown read-only here and edited via
 * «Edit type…». Any per-instance overrides present carry a badge with a clear (✕)
 * action; «Reset to type» clears them all. User types are renamable inline;
 * built-ins are read-only (clone-to-edit via the sibling selector's «Duplicate»).
 *
 * All mutations route through `useOpeningFamilyTypeController` (SSoT). Self-hides
 * for untyped/ad-hoc openings. Mirror of `RibbonWallTypePropertiesWidget` — the
 * shared chrome (header / badges / actions) comes from `family-type-properties-parts`.
 *
 * @see ../hooks/useOpeningFamilyTypeController.ts
 * @see ./RibbonOpeningFamilyTypeWidget.tsx — sibling selector
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useOpeningFamilyTypeController } from '../hooks/useOpeningFamilyTypeController';
import { useFamilyTypeEditor } from '../hooks/useFamilyTypeEditor';
import { openEditOpeningType } from '../../../bim/family-types/edit-opening-type-store';
import type { OpeningTypeParams } from '../../../bim/types/bim-family-type';
import {
  FamilyTypeActions,
  FamilyTypeParamRow,
  FamilyTypePropertiesHeader,
} from './family-type-properties-parts';

export function RibbonOpeningTypePropertiesWidget(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const ctrl = useOpeningFamilyTypeController();
  const { opening, currentType, overriddenKeys } = ctrl;
  const editor = useFamilyTypeEditor(ctrl, openEditOpeningType);

  if (!opening || !currentType) return null;

  const unit = t('ribbon.commands.bimFamilyType.thicknessUnit');
  const none = t('ribbon.commands.bimFamilyType.materialNone');
  const isOverridden = (k: keyof OpeningTypeParams) => overriddenKeys.includes(k);

  return (
    <span className="dxf-ribbon-combobox-row flex-col items-start gap-1">
      <FamilyTypePropertiesHeader ctrl={ctrl} editor={editor} />

      <span className="flex items-center gap-3 flex-wrap">
        <FamilyTypeParamRow
          label={t('ribbon.commands.bimFamilyType.paramWidth')}
          value={`${Math.round(opening.params.width)} ${unit}`}
          overridden={isOverridden('width')}
          onClear={() => ctrl.clearOverride('width')}
        />
        <FamilyTypeParamRow
          label={t('ribbon.commands.bimFamilyType.paramHeight')}
          value={`${Math.round(opening.params.height)} ${unit}`}
          overridden={isOverridden('height')}
          onClear={() => ctrl.clearOverride('height')}
        />
        <FamilyTypeParamRow
          label={t('ribbon.commands.bimFamilyType.paramFrameWidth')}
          value={
            opening.params.frameWidth !== undefined
              ? `${Math.round(opening.params.frameWidth)} ${unit}`
              : none
          }
          overridden={isOverridden('frameWidth')}
          onClear={() => ctrl.clearOverride('frameWidth')}
        />
      </span>

      <span className="flex items-center gap-3 flex-wrap">
        <FamilyTypeParamRow
          label={t('ribbon.commands.bimFamilyType.paramGlazingPanes')}
          value={opening.params.glazingPanes !== undefined ? String(opening.params.glazingPanes) : none}
          overridden={isOverridden('glazingPanes')}
          onClear={() => ctrl.clearOverride('glazingPanes')}
        />
        <FamilyTypeParamRow
          label={t('ribbon.commands.bimFamilyType.paramMaterial')}
          value={opening.params.material ?? none}
          overridden={isOverridden('material')}
          onClear={() => ctrl.clearOverride('material')}
        />
        <span className="flex items-center gap-1 text-xs">
          <span className="dxf-ribbon-combobox-label">
            {t('ribbon.commands.bimFamilyType.paramFireRating')}
          </span>
          <span className="dxf-ribbon-wall-length-value">
            {currentType.typeParams.fireRating ?? none}
          </span>
        </span>
      </span>

      <FamilyTypeActions ctrl={ctrl} editor={editor} />
    </span>
  );
}
