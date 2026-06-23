'use client';

/**
 * ADR-377 Phase D — one row of the Subcategories dialog (Revit Object Styles row).
 *
 * Wired subcategory → editable controls: projection pen, cut pen, line pattern,
 * projection color, cut color + per-row clear [×] (revert to parent ObjectStyle).
 * Stub subcategory (🔒) → greyed, non-editable, tooltip "not rendered yet".
 *
 * Renders as a React.Fragment of grid cells so all rows align under the shared
 * 7-column grid owned by `SubcategoriesPanel`. Pure presentational — all state
 * lives in `useBimRenderSettingsStore`; mutations flow through the bound
 * `onSetField` / `onClear` callbacks.
 */

import React from 'react';
import { Lock, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/RibbonTooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import {
  type BimCategory,
  type ObjectStyle,
  type SubcategoryStyle,
} from '../../../config/bim-object-styles';
import { type LinePatternKey } from '../../../config/bim-line-patterns';
import { type PenIndex } from '../../../config/bim-pen-table';
import { isWiredSubcategory } from '../../../config/bim-subcategories';
import { BimPenSelect, BimPatternSelect } from '../components/BimStyleSelects';
import { UnifiedColorPicker } from '../../color/UnifiedColorPicker';

/** Picker needs a concrete hex even when the stored value is null (canvas token). */
const COLOR_PICKER_FALLBACK = '#000000';

interface SubcategoryRowProps {
  category: BimCategory;
  subcategoryKey: string;
  /** Current per-subcategory override (undefined = none → parent fallback). */
  override: SubcategoryStyle | undefined;
  /** Parent category style — fallback for unset fields + initial picker value. */
  parent: ObjectStyle;
  onSetField: <K extends keyof SubcategoryStyle>(field: K, value: SubcategoryStyle[K]) => void;
  onClear: () => void;
}

export const SubcategoryRow: React.FC<SubcategoryRowProps> = ({
  category,
  subcategoryKey,
  override,
  parent,
  onSetField,
  onClear,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const wired = isWiredSubcategory(category, subcategoryKey);
  const name = t(`ribbon.commands.subcategories.keys.${subcategoryKey}`);

  const nameCell = (
    <span
      className={`flex items-center gap-1.5 ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${
        wired ? colors.text.secondary : colors.text.muted
      } truncate`}
    >
      {!wired && <Lock className="w-3 h-3 shrink-0 opacity-70" aria-hidden />}
      <span className="truncate">{name}</span>
    </span>
  );

  if (!wired) {
    return (
      <>
        {nameCell}
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={`col-span-6 ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} italic select-none`}
            >
              {t('ribbon.commands.subcategories.stubTooltip')}
            </span>
          </TooltipTrigger>
          <TooltipContent>{t('ribbon.commands.subcategories.stubTooltip')}</TooltipContent>
        </Tooltip>
      </>
    );
  }

  const projPen = override?.projectionPen ?? parent.projectionPen;
  const cutPen = override?.cutPen ?? parent.cutPen;
  const pattern: LinePatternKey = override?.linePattern ?? parent.cutPattern ?? 'solid';
  const projColor = override?.projectionColor ?? parent.projectionColor ?? null;
  const cutColor = override?.cutColor ?? parent.cutColor ?? null;
  const hasOverride = !!override && Object.keys(override).length > 0;

  return (
    <>
      {nameCell}
      <BimPenSelect
        value={projPen}
        onChange={(p) => onSetField('projectionPen', p as PenIndex)}
        aria-label={t('ribbon.commands.subcategories.projectionPen')}
        className="min-w-[3rem]"
      />
      <BimPenSelect
        value={cutPen}
        onChange={(p) => onSetField('cutPen', p as PenIndex)}
        aria-label={t('ribbon.commands.subcategories.cutPen')}
        className="min-w-[3rem]"
      />
      <BimPatternSelect
        value={pattern}
        onChange={(pat) => onSetField('linePattern', pat)}
        aria-label={t('ribbon.commands.subcategories.pattern')}
      />
      <ColorCell
        value={projColor}
        ariaLabel={t('ribbon.commands.subcategories.projectionColor')}
        onChange={(c) => onSetField('projectionColor', c)}
      />
      <ColorCell
        value={cutColor}
        ariaLabel={t('ribbon.commands.subcategories.cutColor')}
        onChange={(c) => onSetField('cutColor', c)}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClear}
            disabled={!hasOverride}
            aria-label={t('ribbon.commands.subcategories.resetRow')}
            className={`${PANEL_LAYOUT.SPACING.COMPACT_XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} disabled:opacity-30 ${PANEL_LAYOUT.TRANSITION.COLORS}`}
          >
            <X className="w-3 h-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{t('ribbon.commands.subcategories.resetRow')}</TooltipContent>
      </Tooltip>
    </>
  );
};

interface ColorCellProps {
  value: string | null;
  ariaLabel: string;
  onChange: (color: string) => void;
}

/** Compact swatch color input (canvas token shown as the picker fallback). */
const ColorCell: React.FC<ColorCellProps> = ({ value, ariaLabel, onChange }) => (
  <UnifiedColorPicker
    variant="inline"
    value={value ?? COLOR_PICKER_FALLBACK}
    onChange={onChange}
    showPreview={false}
    showTextInput={false}
    colorInputSize="small"
    label={ariaLabel}
  />
);
