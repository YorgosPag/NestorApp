'use client';

/**
 * ADR-485 (T3-UI / Slice 4c) — «Επάρκεια/Utilization» ribbon toggle (View tab).
 *
 * One-click master switch για το canvas overlay επάρκειας οπλισμού (Robot/SAP2000
 * stress map): ON → κάθε φέρον μέλος βάφεται πράσινο/πορτοκαλί/κόκκινο ανά
 * As,req/As,prov· OFF → κανονικό σχέδιο. Mirror του {@link ShowAnalysisDiagramsToggle}:
 * thin reader/writer του `showUtilization` flag στο TRANSIENT `useAnalysisDiagramViewStore`,
 * διαβασμένο από το `StructuralUtilizationOverlay`.
 */

import React, { useCallback } from 'react';
import { Gauge, Ban } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAnalysisDiagramViewStore } from '../../../state/analysis-diagram-view-store';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';

export const ShowUtilizationToggle: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();

  const showUtilization = useAnalysisDiagramViewStore((s) => s.showUtilization);
  const setShowUtilization = useAnalysisDiagramViewStore((s) => s.setShowUtilization);

  const handleToggle = useCallback(() => {
    setShowUtilization(!showUtilization);
  }, [showUtilization, setShowUtilization]);

  const label = t('ribbon.commands.utilization.label');
  const title = showUtilization
    ? t('ribbon.commands.utilization.tooltipDisable')
    : t('ribbon.commands.utilization.tooltipEnable');

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">{label}</span>
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={showUtilization}
        aria-label={title}
        className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${colors.bg.backgroundSecondary} ${showUtilization ? colors.text.info : colors.text.secondary} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none`}
      >
        {showUtilization
          ? <Gauge className="w-3 h-3 opacity-80" />
          : <Ban className="w-3 h-3 opacity-60" />}
        <span>{showUtilization ? t('ribbon.commands.utilization.disable') : t('ribbon.commands.utilization.enable')}</span>
      </button>
    </span>
  );
};
