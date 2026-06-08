'use client';

/**
 * ADR-422 L4 — «Υδραυλική Εξισορρόπηση» ribbon toggle (View tab).
 *
 * One-click master switch για το hydraulic-balancing overlay (Revit «System
 * Inspector» preview): ON → κάθε καλοριφέρ δείχνει badge με ΔP κυκλώματος + απαιτ. kv
 * balancing valve, με highlight του index circuit + μανομετρικό κυκλοφορητή στην πηγή·
 * OFF → κανονικό σχέδιο. Mirror του {@link ShowPipeSizingToggle}: thin reader/writer
 * του `showBalancing` (transient view flag, `useHydraulicBalancingViewStore`),
 * διαβασμένο από το `HydraulicBalancingOverlay`.
 */

import React, { useCallback } from 'react';
import { Scale, Ban } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useHydraulicBalancingViewStore } from '../../../state/hydraulic-balancing-view-store';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';

export const ShowBalancingToggle: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();

  const showBalancing = useHydraulicBalancingViewStore((s) => s.showBalancing);
  const setShowBalancing = useHydraulicBalancingViewStore((s) => s.setShowBalancing);

  const handleToggle = useCallback(() => {
    setShowBalancing(!showBalancing);
  }, [showBalancing, setShowBalancing]);

  const label = t('ribbon.commands.balancing.label');
  const title = showBalancing
    ? t('ribbon.commands.balancing.tooltipDisable')
    : t('ribbon.commands.balancing.tooltipEnable');

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">{label}</span>
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={showBalancing}
        aria-label={title}
        className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${colors.bg.backgroundSecondary} ${showBalancing ? colors.text.info : colors.text.secondary} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none`}
      >
        {showBalancing
          ? <Scale className="w-3 h-3 opacity-80" />
          : <Ban className="w-3 h-3 opacity-60" />}
        <span>{showBalancing ? t('ribbon.commands.balancing.disable') : t('ribbon.commands.balancing.enable')}</span>
      </button>
    </span>
  );
};
