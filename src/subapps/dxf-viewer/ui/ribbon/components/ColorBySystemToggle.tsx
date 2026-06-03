'use client';

/**
 * ADR-408 Φ7 — "Colour by system" ribbon toggle (View tab).
 *
 * One-click master switch for the colour-by-system graphics (Revit's "Color
 * circuits by system" view option): ON → circuit fixtures / panels / home-run
 * wires paint with their owning System's colour; OFF → they fall back to the
 * renderer default colour. Mirrors {@link MepWireToggle}: a thin reader/writer of
 * the single `colorBySystem` per-view flag on `useBimRenderSettingsStore` (the
 * SSoT, Firestore-persisted), read by every 2D + 3D colour gate.
 */

import React, { useCallback } from 'react';
import { Palette, Ban } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';

export const ColorBySystemToggle: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();

  const colorBySystem = useBimRenderSettingsStore((s) => s.colorBySystem);
  const setColorBySystem = useBimRenderSettingsStore((s) => s.setColorBySystem);

  const handleToggle = useCallback(() => {
    setColorBySystem(!colorBySystem);
  }, [colorBySystem, setColorBySystem]);

  const label = t('ribbon.commands.colorBySystem.label');
  const title = colorBySystem
    ? t('ribbon.commands.colorBySystem.tooltipDisable')
    : t('ribbon.commands.colorBySystem.tooltipEnable');

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">{label}</span>
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={colorBySystem}
        aria-label={title}
        className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${colors.bg.backgroundSecondary} ${colorBySystem ? colors.text.info : colors.text.secondary} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none`}
      >
        {colorBySystem
          ? <Palette className="w-3 h-3 opacity-80" />
          : <Ban className="w-3 h-3 opacity-60" />}
        <span>{colorBySystem ? t('ribbon.commands.colorBySystem.disable') : t('ribbon.commands.colorBySystem.enable')}</span>
      </button>
    </span>
  );
};
