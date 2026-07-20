/**
 * 🌊 GridAdaptiveFadeSection — UI for the adaptive grid behaviour
 *
 * Extracted from `GridSettings.tsx` to keep that component under the
 * Google-level 500-line limit (CLAUDE.md SOS. N.7.1). Renders the toggle +
 * the temporal-lerp duration slider, driving
 * `gridSettings.behavior.{smoothFade, smoothFadeDurationMs}`.
 *
 * The former `smoothFadeMinPx` / `smoothFadeMaxPx` sliders are GONE by design:
 * the cross-fade window is derived from the cascade band (MAXON/C4D model, see
 * `rendering/ui/grid/grid-adaptive.ts`). Exposing it let the window drift
 * outside the band, which silently disabled the cross-fade and produced the
 * 2026-07-20 density jump. Duration stays — it is orthogonal to the window.
 *
 * @module ui/components/dxf-settings/settings/special/GridAdaptiveFadeSection
 */

'use client';

import React from 'react';
import { Switch } from '@/components/ui/switch';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n';
import { PANEL_LAYOUT } from '../../../../../config/panel-tokens';
import { SliderInput } from '../../../shared/SliderInput';

interface AdaptiveFadeView {
  smoothFade: boolean;
  smoothFadeDurationMs: number;
}

interface GridAdaptiveFadeSectionProps {
  fade: AdaptiveFadeView;
  onToggle: (enabled: boolean) => void;
  onFadeDurationChange: (ms: number) => void;
}

export function GridAdaptiveFadeSection({
  fade,
  onToggle,
  onFadeDurationChange,
}: GridAdaptiveFadeSectionProps) {
  const { t } = useTranslation([
    'dxf-viewer',
    'dxf-viewer-settings',
    'dxf-viewer-wizard',
    'dxf-viewer-guides',
    'dxf-viewer-panels',
    'dxf-viewer-shell',
  ]);
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();

  return (
    <section className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${quick.card} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary}`}>
            {t('gridSettings.adaptive.title')}
          </h4>
          <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>
            {t('gridSettings.adaptive.description')}
          </p>
        </div>
        <Switch checked={fade.smoothFade} onCheckedChange={onToggle} variant="status" />
      </div>

      {fade.smoothFade && (
        <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.muted} ${quick.card} ${PANEL_LAYOUT.SPACING.GAP_SM} ${PANEL_LAYOUT.MARGIN.TOP_SM}`}>
          <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>{t('gridSettings.adaptive.fadeDurationDescription')}</p>
          <SliderInput label={t('gridSettings.adaptive.fadeDurationLabel')} value={fade.smoothFadeDurationMs} min={0} max={2000} step={50} onChange={onFadeDurationChange} showValue formatValue={(v) => `${v}ms`} />
        </div>
      )}
    </section>
  );
}

