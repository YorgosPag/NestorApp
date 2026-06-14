'use client';

// ============================================================================
// ✂️ AxisCutSliderControl — ADR-455 vertical section-cut «L» slider (X or Y)
// ============================================================================
//
// Parametric control for ONE vertical section cut (world DXF X or Y). Renders through
// the SHARED SectionSliderShell (ADR-455 appearance SSoT — identical theme/chrome to the
// horizontal cut, ADR-452), supplying only its data + the type-specific icon and the «L»
// short branch: a direction-arrow button that points toward the KEPT (viewed) side and,
// on click, FLIPS the sign (swaps the kept/ghost sides). Drives the axis-cut SSoT
// (`xAxisCut`/`yAxisCut`): 3D clips the cut-away half-space, 2D ghosts it + draws the
// section line. Axis 'x' = horizontal slider (canvas base); 'y' = vertical (canvas left).
// ============================================================================

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import type { AxisCutKey } from '../../config/bim-render-settings-types';
import type { AxisCutRange } from './axis-cut-range';
import { SectionSliderShell } from './SectionSliderShell';

export interface AxisCutSliderControlProps {
  readonly axis: AxisCutKey;
  readonly range: AxisCutRange | null;
  /** Absolute-position + stacking classes supplied by the mounting leaf. */
  readonly className?: string;
}

function clamp(v: number, range: AxisCutRange): number {
  return Math.min(range.max, Math.max(range.min, v));
}

/** Arrow points right by default; rotate toward the KEPT side per axis + sign. */
function arrowRotationClass(axis: AxisCutKey, sign: 1 | -1): string {
  if (axis === 'x') return sign === 1 ? 'rotate-180' : 'rotate-0'; // keep lower X ⇒ ←
  return sign === 1 ? 'rotate-90' : '-rotate-90'; // keep lower Y ⇒ ↓ (screen)
}

export const AxisCutSliderControl = React.memo(function AxisCutSliderControl({
  axis,
  range,
  className = '',
}: AxisCutSliderControlProps) {
  const { t } = useTranslation('dxf-viewer-panels');
  const cut = useBimRenderSettingsStore((s) => (axis === 'x' ? s.xAxisCut : s.yAxisCut));

  if (!range) return null;

  const horizontal = axis === 'x';
  const value = clamp(cut.position, range);
  const step = Math.max((range.max - range.min) / 1000, 1e-6);

  const setPosition = (p: number) => useBimRenderSettingsStore.getState().setAxisCutPosition(axis, p);
  const setActive = (a: boolean) => useBimRenderSettingsStore.getState().setAxisCutActive(axis, a);
  const setSign = (sgn: 1 | -1) => useBimRenderSettingsStore.getState().setAxisCutSign(axis, sgn);

  const handleSlider = (next: number) => {
    setPosition(next);
    if (!cut.active) setActive(true);
  };
  const handleToggle = () => {
    const next = !cut.active;
    setActive(next);
    if (next) setPosition(range.default); // enable «from scratch» → model midpoint
  };
  const handleFlip = () => {
    setSign(cut.sign === 1 ? -1 : 1);
    if (!cut.active) setActive(true);
  };

  return (
    <SectionSliderShell
      orientation={horizontal ? 'horizontal' : 'vertical'}
      active={cut.active}
      onToggle={handleToggle}
      toggleAriaLabel={cut.active ? t('axisCut.disable') : t('axisCut.enable')}
      icon={<AxisCutIcon axis={axis} />}
      readout={`${value.toFixed(2)}${t('axisCut.unit')}`}
      label={horizontal ? t('axisCut.labelX') : t('axisCut.labelY')}
      min={range.min}
      max={range.max}
      step={step}
      value={value}
      ariaSlider={t('axisCut.ariaSlider')}
      onValueChange={handleSlider}
      positionClassName={className}
      extraControl={
        <button
          type="button"
          onClick={handleFlip}
          aria-label={t('axisCut.flip')}
          className="flex cursor-pointer select-none items-center justify-center rounded border border-border bg-background/80 p-1.5 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowGlyph className={arrowRotationClass(axis, cut.sign)} />
        </button>
      }
    />
  );
});

/** Box glyph with a vertical (X cut) or horizontal (Y cut) section line through it. */
function AxisCutIcon({ axis }: { axis: AxisCutKey }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="10" height="10" rx="1.2" stroke="currentColor" strokeWidth="1.1" />
      {axis === 'x' ? (
        <path d="M8 1.5V14.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      ) : (
        <path d="M1.5 8H14.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      )}
    </svg>
  );
}

/** Right-pointing arrow; the caller rotates it via a Tailwind rotate class. */
function ArrowGlyph({ className = '' }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={`transition-transform ${className}`}>
      <path d="M3 8H12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8.5 4.5L12 8L8.5 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
