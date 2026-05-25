'use client';

/**
 * ADR-375 Phase B.2 — View Range Panel.
 *
 * Ribbon widget that exposes 4 ViewRange plane inputs (mm):
 *   Top / Cut Plane / Bottom / View Depth.
 *
 * Reads from `useBimRenderSettingsStore` (SSoT).
 * Writes via `setViewRangeField` (500ms debounce → Firestore).
 * UI: compact trigger showing "⬛ Εύρος" + DropdownMenu with 4 inputs.
 */

import React, { useState, useCallback } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { type ViewRange } from '../../../config/bim-view-range';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { useBorderTokens } from '@/hooks/useBorderTokens';

const VIEW_RANGE_FIELDS: { key: keyof ViewRange; i18nKey: string }[] = [
  { key: 'topMm',           i18nKey: 'ribbon.commands.viewRange.topMm' },
  { key: 'cutPlaneMm',      i18nKey: 'ribbon.commands.viewRange.cutPlaneMm' },
  { key: 'bottomMm',        i18nKey: 'ribbon.commands.viewRange.bottomMm' },
  { key: 'viewDepthMm',     i18nKey: 'ribbon.commands.viewRange.viewDepthMm' },
];

export const ViewRangePanel: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const { getStatusBorder, getFocusBorder } = useBorderTokens();
  const [open, setOpen] = useState(false);

  const viewRange = useBimRenderSettingsStore((s) => s.viewRange);
  const setViewRangeField = useBimRenderSettingsStore((s) => s.setViewRangeField);
  const resetToDefaults = useBimRenderSettingsStore((s) => s.resetToDefaults);

  const handleFieldChange = useCallback(
    (field: keyof ViewRange, raw: string) => {
      const parsed = parseFloat(raw);
      if (!Number.isFinite(parsed)) return;
      setViewRangeField(field, Math.round(parsed));
    },
    [setViewRangeField],
  );

  const handleReset = useCallback(() => {
    resetToDefaults();
    setOpen(false);
  }, [resetToDefaults]);

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">
        {t('ribbon.commands.viewRange.label')}
      </span>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={t('ribbon.commands.viewRange.label')}
            className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${colors.bg.backgroundSecondary} ${colors.text.secondary} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none`}
          >
            <span>{viewRange.cutPlaneMm}</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 p-2">
          <div className="space-y-2">
            {VIEW_RANGE_FIELDS.map(({ key, i18nKey }) => (
              <div key={key} className="flex items-center justify-between gap-2">
                <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.secondary} truncate flex-1`}>
                  {t(i18nKey)}
                </span>
                <input
                  type="number"
                  defaultValue={viewRange[key]}
                  key={`${key}-${viewRange[key]}`}
                  onBlur={(e) => handleFieldChange(key, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleFieldChange(key, (e.target as HTMLInputElement).value);
                    }
                  }}
                  className={`w-20 ${PANEL_LAYOUT.TYPOGRAPHY.XS} text-right rounded ${PANEL_LAYOUT.SPACING.COMPACT_XS} ${colors.bg.secondary} ${getStatusBorder('muted')} ${colors.text.inverted} ${getFocusBorder('input')} focus:outline-none font-mono`}
                />
              </div>
            ))}
          </div>
          <DropdownMenuSeparator className="my-2" />
          <button
            onClick={handleReset}
            aria-label={t('ribbon.commands.viewRange.resetAriaLabel')}
            className={`flex items-center gap-1.5 w-full ${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.secondary} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS}`}
          >
            <RotateCcw className="w-3 h-3" />
            {t('ribbon.commands.viewRange.reset')}
          </button>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
};
