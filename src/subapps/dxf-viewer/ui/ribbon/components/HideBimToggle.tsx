'use client';

/**
 * ADR-375 Phase C.8 — "Hide BIM / Show only DXF" ribbon toggle.
 *
 * One-click isolate of all structural BIM object categories
 * (`STRUCTURAL_BIM_CATEGORIES`) so only the imported DXF entities remain
 * visible. Re-clicking restores the prior per-category visibility (snapshot
 * managed by the store), mirroring Revit's "Hide in View" / AutoCAD isolate.
 *
 * SSoT: reads/writes `useBimRenderSettingsStore.objectStyles` via the batch
 * `setBimObjectsVisibility` action (single debounced Firestore write).
 */

import React, { useCallback } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { STRUCTURAL_BIM_CATEGORIES } from '../../../config/bim-object-styles';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';

export const HideBimToggle: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();

  const objectStyles = useBimRenderSettingsStore((s) => s.objectStyles);
  const setBimObjectsVisibility = useBimRenderSettingsStore((s) => s.setBimObjectsVisibility);

  const isBimHidden = STRUCTURAL_BIM_CATEGORIES.every(
    (cat) => objectStyles[cat].visible === false,
  );

  const handleToggle = useCallback(() => {
    setBimObjectsVisibility(isBimHidden);
  }, [isBimHidden, setBimObjectsVisibility]);

  const label = isBimHidden
    ? t('ribbon.commands.hideBim.show')
    : t('ribbon.commands.hideBim.hide');
  const title = isBimHidden
    ? t('ribbon.commands.hideBim.tooltipShow')
    : t('ribbon.commands.hideBim.tooltipHide');

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">
        {t('ribbon.commands.hideBim.label')}
      </span>
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={isBimHidden}
        aria-label={title}
        className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${colors.bg.backgroundSecondary} ${isBimHidden ? colors.text.info : colors.text.secondary} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none`}
      >
        {isBimHidden
          ? <EyeOff className="w-3 h-3 opacity-80" />
          : <Eye className="w-3 h-3 opacity-60" />}
        <span>{label}</span>
      </button>
    </span>
  );
};
