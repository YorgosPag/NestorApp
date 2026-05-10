/**
 * 🌊 GridAdaptiveFadeSection — UI for the adaptive grid behaviour
 *
 * Extracted from `GridSettings.tsx` to keep that component under the
 * Google-level 500-line limit (CLAUDE.md SOS. N.7.1). Renders the toggle +
 * 3 sliders that drive `gridSettings.behavior.{smoothFade, smoothFadeMinPx,
 * smoothFadeMaxPx, smoothFadeDurationMs}` (industry pattern: AutoCAD /
 * Fusion 360 / OnShape / Figma / Miro).
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
  smoothFadeMinPx: number;
  smoothFadeMaxPx: number;
  smoothFadeDurationMs: number;
}

interface GridAdaptiveFadeSectionProps {
  fade: AdaptiveFadeView;
  onToggle: (enabled: boolean) => void;
  onFadeMinChange: (px: number) => void;
  onFadeMaxChange: (px: number) => void;
  onFadeDurationChange: (ms: number) => void;
}

export function GridAdaptiveFadeSection({
  fade,
  onToggle,
  onFadeMinChange,
  onFadeMaxChange,
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
        <>
          <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.muted} ${quick.card} ${PANEL_LAYOUT.SPACING.GAP_SM} ${PANEL_LAYOUT.MARGIN.TOP_SM}`}>
            <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>{t('gridSettings.adaptive.fadeMinDescription')}</p>
            <SliderInput label={t('gridSettings.adaptive.fadeMinLabel')} value={fade.smoothFadeMinPx} min={2} max={32} step={1} onChange={onFadeMinChange} showValue formatValue={(v) => `${v}px`} />
          </div>
          <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.muted} ${quick.card} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
            <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>{t('gridSettings.adaptive.fadeMaxDescription')}</p>
            <SliderInput label={t('gridSettings.adaptive.fadeMaxLabel')} value={fade.smoothFadeMaxPx} min={8} max={128} step={1} onChange={onFadeMaxChange} showValue formatValue={(v) => `${v}px`} />
          </div>
          <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.muted} ${quick.card} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
            <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>{t('gridSettings.adaptive.fadeDurationDescription')}</p>
            <SliderInput label={t('gridSettings.adaptive.fadeDurationLabel')} value={fade.smoothFadeDurationMs} min={0} max={2000} step={50} onChange={onFadeDurationChange} showValue formatValue={(v) => `${v}ms`} />
          </div>
        </>
      )}
    </section>
  );
}

