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
          <SliderRow
            labelKey="gridSettings.adaptive.fadeMinLabel"
            descKey="gridSettings.adaptive.fadeMinDescription"
            min={2}
            max={32}
            step={1}
            value={fade.smoothFadeMinPx}
            suffix="px"
            onChange={onFadeMinChange}
            mtSm
          />
          <SliderRow
            labelKey="gridSettings.adaptive.fadeMaxLabel"
            descKey="gridSettings.adaptive.fadeMaxDescription"
            min={8}
            max={128}
            step={1}
            value={fade.smoothFadeMaxPx}
            suffix="px"
            onChange={onFadeMaxChange}
          />
          <SliderRow
            labelKey="gridSettings.adaptive.fadeDurationLabel"
            descKey="gridSettings.adaptive.fadeDurationDescription"
            min={0}
            max={2000}
            step={50}
            value={fade.smoothFadeDurationMs}
            suffix="ms"
            onChange={onFadeDurationChange}
          />
        </>
      )}
    </section>
  );
}

interface SliderRowProps {
  labelKey: string;
  descKey: string;
  min: number;
  max: number;
  step: number;
  value: number;
  suffix: string;
  onChange: (n: number) => void;
  mtSm?: boolean;
}

function SliderRow({ labelKey, descKey, min, max, step, value, suffix, onChange, mtSm }: SliderRowProps) {
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
    <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.muted} ${quick.card} ${PANEL_LAYOUT.SPACING.GAP_SM}${mtSm ? ` ${PANEL_LAYOUT.MARGIN.TOP_SM}` : ''}`}>
      <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
        <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t(labelKey)}</div>
        <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{t(descKey)}</div>
      </div>
      <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="flex-1"
        />
        <div className={`${PANEL_LAYOUT.WIDTH.VALUE_DISPLAY} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.primary} ${colors.text.primary} ${quick.button} ${PANEL_LAYOUT.SPACING.XS} ${PANEL_LAYOUT.TEXT_ALIGN.CENTER}`}>
          {value}{suffix}
        </div>
      </div>
    </div>
  );
}
