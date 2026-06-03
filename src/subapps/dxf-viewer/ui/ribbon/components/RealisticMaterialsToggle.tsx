'use client';

/**
 * ADR-413 — "Realistic materials" ribbon toggle (View tab).
 *
 * One-click master switch for realistic PBR materials (Revit's "Realistic"
 * visual style): ON → BIM elements render with textured MeshStandardMaterials
 * (albedo/normal/roughness/ao); OFF → they fall back to flat colour materials.
 * Mirrors {@link ColorBySystemToggle}: a thin reader/writer of the single
 * `realisticMaterials` per-view flag on `useBimRenderSettingsStore` (the SSoT,
 * Firestore-persisted), read by the 3D material catalog getters.
 */

import React, { useCallback } from 'react';
import { Sparkles, Ban } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';

export const RealisticMaterialsToggle: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();

  const realisticMaterials = useBimRenderSettingsStore((s) => s.realisticMaterials);
  const setRealisticMaterials = useBimRenderSettingsStore((s) => s.setRealisticMaterials);

  const handleToggle = useCallback(() => {
    setRealisticMaterials(!realisticMaterials);
  }, [realisticMaterials, setRealisticMaterials]);

  const label = t('ribbon.commands.realisticMaterials.label');
  const title = realisticMaterials
    ? t('ribbon.commands.realisticMaterials.tooltipDisable')
    : t('ribbon.commands.realisticMaterials.tooltipEnable');

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">{label}</span>
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={realisticMaterials}
        aria-label={title}
        className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${colors.bg.backgroundSecondary} ${realisticMaterials ? colors.text.info : colors.text.secondary} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none`}
      >
        {realisticMaterials
          ? <Sparkles className="w-3 h-3 opacity-80" />
          : <Ban className="w-3 h-3 opacity-60" />}
        <span>{realisticMaterials ? t('ribbon.commands.realisticMaterials.disable') : t('ribbon.commands.realisticMaterials.enable')}</span>
      </button>
    </span>
  );
};
