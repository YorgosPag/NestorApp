'use client';

/**
 * ADR-422 L1 — "Θερμικό Φορτίο" ribbon toggle (View tab).
 *
 * One-click master switch για το analytical heat-load overlay (Revit «Heating
 * Loads» χρωματικό φίλτρο): ON → κάθε θερμικός χώρος βάφεται με heat-map +
 * ετικέτα φορτίου· OFF → κανονικό σχέδιο. Mirror του {@link ColorBySystemToggle}:
 * thin reader/writer του `showHeatLoad` per-view flag στο
 * `useBimRenderSettingsStore` (SSoT, Firestore-persisted), διαβασμένο από το
 * `HeatLoadOverlay`.
 */

import React, { useCallback } from 'react';
import { Flame, Ban } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';

export const ShowHeatLoadToggle: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();

  const showHeatLoad = useBimRenderSettingsStore((s) => s.showHeatLoad);
  const setShowHeatLoad = useBimRenderSettingsStore((s) => s.setShowHeatLoad);

  const handleToggle = useCallback(() => {
    setShowHeatLoad(!showHeatLoad);
  }, [showHeatLoad, setShowHeatLoad]);

  const label = t('ribbon.commands.heatLoad.label');
  const title = showHeatLoad
    ? t('ribbon.commands.heatLoad.tooltipDisable')
    : t('ribbon.commands.heatLoad.tooltipEnable');

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">{label}</span>
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={showHeatLoad}
        aria-label={title}
        className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${colors.bg.backgroundSecondary} ${showHeatLoad ? colors.text.info : colors.text.secondary} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none`}
      >
        {showHeatLoad
          ? <Flame className="w-3 h-3 opacity-80" />
          : <Ban className="w-3 h-3 opacity-60" />}
        <span>{showHeatLoad ? t('ribbon.commands.heatLoad.disable') : t('ribbon.commands.heatLoad.enable')}</span>
      </button>
    </span>
  );
};
