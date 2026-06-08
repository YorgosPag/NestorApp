'use client';

/**
 * ADR-422 L3 — «Διαστασιολόγηση Σωληνώσεων» ribbon toggle (View tab).
 *
 * One-click master switch για το pipe-sizing overlay (Revit «Pipe Sizing» preview):
 * ON → κάθε σωλήνας θέρμανσης δείχνει badge με προτεινόμενη DN + ταχύτητα· OFF →
 * κανονικό σχέδιο. Mirror του {@link ShowHeatLoadToggle}: thin reader/writer του
 * `showPipeSizing` (transient view flag, `usePipeSizingViewStore`), διαβασμένο από
 * το `PipeSizingOverlay`.
 */

import React, { useCallback } from 'react';
import { Gauge, Ban } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePipeSizingViewStore } from '../../../state/pipe-sizing-view-store';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';

export const ShowPipeSizingToggle: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();

  const showPipeSizing = usePipeSizingViewStore((s) => s.showPipeSizing);
  const setShowPipeSizing = usePipeSizingViewStore((s) => s.setShowPipeSizing);

  const handleToggle = useCallback(() => {
    setShowPipeSizing(!showPipeSizing);
  }, [showPipeSizing, setShowPipeSizing]);

  const label = t('ribbon.commands.pipeSizing.label');
  const title = showPipeSizing
    ? t('ribbon.commands.pipeSizing.tooltipDisable')
    : t('ribbon.commands.pipeSizing.tooltipEnable');

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">{label}</span>
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={showPipeSizing}
        aria-label={title}
        className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${colors.bg.backgroundSecondary} ${showPipeSizing ? colors.text.info : colors.text.secondary} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none`}
      >
        {showPipeSizing
          ? <Gauge className="w-3 h-3 opacity-80" />
          : <Ban className="w-3 h-3 opacity-60" />}
        <span>{showPipeSizing ? t('ribbon.commands.pipeSizing.disable') : t('ribbon.commands.pipeSizing.enable')}</span>
      </button>
    </span>
  );
};
