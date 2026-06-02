'use client';

/**
 * ADR-375 Phase B.2 — Object Styles Panel.
 *
 * Ribbon widget that exposes per-category pen assignments:
 *   12 BIM categories × 2 pen selectors (projectionPen, cutPen, values 1-16).
 *
 * Reads from `useBimRenderSettingsStore` (SSoT).
 * Writes via `setObjectStyleField` (500ms debounce → Firestore).
 * UI: compact trigger → DropdownMenu with 12-row table.
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
import { BIM_CATEGORIES, type BimCategory } from '../../../config/bim-object-styles';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { BimPenSelect } from '../components/BimStyleSelects';

export const ObjectStylesPanel: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const [open, setOpen] = useState(false);

  const objectStyles = useBimRenderSettingsStore((s) => s.objectStyles);
  const setObjectStyleField = useBimRenderSettingsStore((s) => s.setObjectStyleField);
  const resetToDefaults = useBimRenderSettingsStore((s) => s.resetToDefaults);

  const handlePenChange = useCallback(
    (category: BimCategory, key: 'projectionPen' | 'cutPen', pen: number) => {
      if (pen >= 1 && pen <= 16) setObjectStyleField(category, key, pen);
    },
    [setObjectStyleField],
  );

  const handleReset = useCallback(() => {
    resetToDefaults();
    setOpen(false);
  }, [resetToDefaults]);

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">
        {t('ribbon.commands.objectStyles.label')}
      </span>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={t('ribbon.commands.objectStyles.label')}
            className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${colors.bg.backgroundSecondary} ${colors.text.secondary} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none`}
          >
            <span>12</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72 p-2">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 gap-y-1 items-center">
            <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} font-medium`}></span>
            <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} font-medium text-center`}>
              {t('ribbon.commands.objectStyles.projectionPen')}
            </span>
            <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} font-medium text-center`}>
              {t('ribbon.commands.objectStyles.cutPen')}
            </span>

            {BIM_CATEGORIES.map((cat) => (
              <React.Fragment key={cat}>
                <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.secondary} truncate`}>
                  {t(`ribbon.commands.objectStyles.categories.${cat}`)}
                </span>
                <BimPenSelect
                  value={objectStyles[cat].projectionPen}
                  onChange={(pen) => handlePenChange(cat, 'projectionPen', pen)}
                  className="min-w-[3.25rem]"
                  aria-label={t('ribbon.commands.objectStyles.projectionPen')}
                />
                <BimPenSelect
                  value={objectStyles[cat].cutPen}
                  onChange={(pen) => handlePenChange(cat, 'cutPen', pen)}
                  className="min-w-[3.25rem]"
                  aria-label={t('ribbon.commands.objectStyles.cutPen')}
                />
              </React.Fragment>
            ))}
          </div>
          <DropdownMenuSeparator className="my-2" />
          <button
            onClick={handleReset}
            aria-label={t('ribbon.commands.objectStyles.resetAriaLabel')}
            className={`flex items-center gap-1.5 w-full ${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.secondary} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS}`}
          >
            <RotateCcw className="w-3 h-3" />
            {t('ribbon.commands.objectStyles.reset')}
          </button>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
};
