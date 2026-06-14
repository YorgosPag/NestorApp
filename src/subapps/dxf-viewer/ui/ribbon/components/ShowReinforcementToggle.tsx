'use client';

/**
 * ADR-456 Slice 3 — "Οπλισμός" ribbon toggle (View tab).
 *
 * One-click master switch για τη σχεδίαση οπλισμού κολώνας (διαμήκεις ράβδες +
 * στεφάνια): ON → κάθε ορθογωνική κολώνα με ορισμένο `reinforcement` δείχνει τις
 * ράβδες/στεφάνια σε 2D κάτοψη + 3D/τομή· OFF → γυμνή διατομή. Mirror του
 * {@link ShowFinishSkinToggle}: thin reader/writer του `showReinforcement` per-view
 * flag στο `useBimRenderSettingsStore` (SSoT, Firestore-persisted), διαβασμένο
 * event-time από τον 2D orchestrator + 3D converter. Visibility-only (Revit):
 * το schedule μετράει πάντα τον οπλισμό — schedule = model, όχι view.
 */

import React, { useCallback } from 'react';
import { Grid2x2Check, Grid2x2X } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';

export const ShowReinforcementToggle: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();

  const showReinforcement = useBimRenderSettingsStore((s) => s.showReinforcement);
  const setShowReinforcement = useBimRenderSettingsStore((s) => s.setShowReinforcement);

  const handleToggle = useCallback(() => {
    setShowReinforcement(!showReinforcement);
  }, [showReinforcement, setShowReinforcement]);

  const label = t('ribbon.commands.reinforcement.label');
  const title = showReinforcement
    ? t('ribbon.commands.reinforcement.tooltipDisable')
    : t('ribbon.commands.reinforcement.tooltipEnable');

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">{label}</span>
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={showReinforcement}
        aria-label={title}
        className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${colors.bg.backgroundSecondary} ${showReinforcement ? colors.text.info : colors.text.secondary} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none`}
      >
        {showReinforcement
          ? <Grid2x2Check className="w-3 h-3 opacity-80" />
          : <Grid2x2X className="w-3 h-3 opacity-60" />}
        <span>{showReinforcement ? t('ribbon.commands.reinforcement.disable') : t('ribbon.commands.reinforcement.enable')}</span>
      </button>
    </span>
  );
};
