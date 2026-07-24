'use client';

/**
 * ADR-687 Φ9 — «Ποιότητα Γυαλιού» ribbon dropdown (View tab, next to «Στυλ Προβολής»).
 *
 * A single Radix `@/components/ui/select` (ADR-001 — NOT EnterpriseComboBox / native
 * `<select>`) that picks the per-view {@link GlassQuality}. Thin reader/writer of the
 * `glassQuality` field on `useBimRenderSettingsStore` (the SSoT, Firestore-persisted) —
 * same shape as {@link VisualStyleSelect}. The 3D face-material factory reads the resolved
 * value event-time; `useBim3DVgResync` rebuilds the scene when it flips. Affects ONLY the
 * live viewport: the material-editor preview sphere, swatches and 3Δ export stay accurate.
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import {
  GLASS_QUALITY_OPTIONS,
  type GlassQuality,
} from '../../../config/bim-visual-style';

export const GlassQualitySelect: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const glassQuality = useBimRenderSettingsStore((s) => s.glassQuality);
  const setGlassQuality = useBimRenderSettingsStore((s) => s.setGlassQuality);

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">{t('ribbon.commands.glassQuality.label')}</span>
      <Select value={glassQuality} onValueChange={(v) => setGlassQuality(v as GlassQuality)}>
        <SelectTrigger
          size="sm"
          aria-label={t('ribbon.commands.glassQuality.label')}
          title={t('ribbon.commands.glassQuality.tooltip')}
        >
          <SelectValue />
        </SelectTrigger>
        {/* w-auto overrides the popper's trigger-width lock so the Greek labels are never clipped. */}
        <SelectContent className="w-auto min-w-[9rem]">
          {GLASS_QUALITY_OPTIONS.map((option) => (
            <SelectItem key={option} value={option} className="whitespace-nowrap">
              {t(`ribbon.commands.glassQuality.options.${option}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </span>
  );
};
