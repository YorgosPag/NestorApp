'use client';

/**
 * ADR-449 Slice 5 — "Σοβατισμένη Όψη" ribbon toggle (View tab).
 *
 * One-click master switch για τον δομικό σοβά (structural finish skin) κολόνων &
 * δοκαριών: ON → κάθε εκτεθειμένη παρειά αποκτά περιμετρικό δέρμα σοβά (2D finished
 * outline + 3D band skin)· OFF → προβολή γυμνού στατικού πυρήνα. Mirror του
 * {@link ShowHeatLoadToggle}: thin reader/writer του `showFinishSkin` per-view flag
 * στο `useBimRenderSettingsStore` (SSoT, Firestore-persisted), διαβασμένο event-time
 * από τον 2D orchestrator (`DxfRenderer`) + 3D converter. Visibility-only (Revit):
 * το BOQ μετράει πάντα τον σοβά — schedule = model, όχι view.
 */

import React, { useCallback } from 'react';
import { PaintRoller, SquareDashed } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';

export const ShowFinishSkinToggle: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();

  const showFinishSkin = useBimRenderSettingsStore((s) => s.showFinishSkin);
  const setShowFinishSkin = useBimRenderSettingsStore((s) => s.setShowFinishSkin);

  const handleToggle = useCallback(() => {
    setShowFinishSkin(!showFinishSkin);
  }, [showFinishSkin, setShowFinishSkin]);

  const label = t('ribbon.commands.finishSkin.label');
  const title = showFinishSkin
    ? t('ribbon.commands.finishSkin.tooltipDisable')
    : t('ribbon.commands.finishSkin.tooltipEnable');

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">{label}</span>
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={showFinishSkin}
        aria-label={title}
        className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${colors.bg.backgroundSecondary} ${showFinishSkin ? colors.text.info : colors.text.secondary} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none`}
      >
        {showFinishSkin
          ? <PaintRoller className="w-3 h-3 opacity-80" />
          : <SquareDashed className="w-3 h-3 opacity-60" />}
        <span>{showFinishSkin ? t('ribbon.commands.finishSkin.disable') : t('ribbon.commands.finishSkin.enable')}</span>
      </button>
    </span>
  );
};
