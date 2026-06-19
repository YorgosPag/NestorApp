'use client';

// ============================================================================
// ✂️ CutPlaneSliderControl — ADR-452 presentational cut-plane slider
// ============================================================================
//
// Mode-agnostic vertical slider that drives the single cut-plane SSoT
// (`viewRange.cutPlaneMm` + `cutPlaneActive` in the BIM render-settings store).
// Mounted by two thin wrappers: `CutPlaneSliderLeaf` (2D, mode-gated) and
// `CutPlaneSlider3DLeaf` (inside BimViewport3D). FFL-relative range comes from
// `useCutPlaneRange` (0 … active storey height).
//
// 2D drives the hide gate; 3D drives a horizontal clipping plane — same elevation.
// ============================================================================

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import { useCutPlaneRange, type CutPlaneRange } from './useCutPlaneRange';
// ADR-455 — shared appearance SSoT for ALL on-canvas cut sliders (theme + chrome).
import { SectionSliderShell } from './SectionSliderShell';

const CUT_PLANE_STEP_MM = 10;

function clampToRange(mm: number, range: CutPlaneRange): number {
  return Math.min(range.maxMm, Math.max(range.minMm, mm));
}

export interface CutPlaneSliderControlProps {
  /**
   * Stacking + top-offset class for the host. Each mount owns its `top-*` because the
   * track length differs per mode: 2D has nothing above-right (`top-14 z-30`); 3D must
   * clear the 160px ViewCube canvas at `top:12px` so it sits below it (`top-44 z-[60]`).
   */
  readonly className?: string;
}

export const CutPlaneSliderControl = React.memo(function CutPlaneSliderControl({
  className = 'top-14 z-30',
}: CutPlaneSliderControlProps) {
  const { t } = useTranslation('dxf-viewer-panels');
  const active = useBimRenderSettingsStore((s) => s.cutPlaneActive);
  const cutMm = useBimRenderSettingsStore((s) => s.viewRange.cutPlaneMm);
  const range = useCutPlaneRange();

  if (!range) return null;

  const value = clampToRange(cutMm, range);
  const setCut = (mm: number) => useBimRenderSettingsStore.getState().setViewRangeField('cutPlaneMm', mm);
  const setActive = (next: boolean) => useBimRenderSettingsStore.getState().setCutPlaneActive(next);

  const handleSlider = ([next]: number[]) => {
    setCut(next);
    if (!active) setActive(true);
  };
  const handleToggle = () => {
    const next = !active;
    setActive(next);
    // Enabling «from scratch» starts at the storey ceiling → full model first, then slide down.
    if (next) setCut(range.defaultMm);
  };

  const meters = (value / 1000).toFixed(2);

  return (
    <SectionSliderShell
      orientation="vertical"
      dataTestId="section-slider-horizontal"
      active={active}
      onToggle={handleToggle}
      toggleAriaLabel={active ? t('cutPlane.disable') : t('cutPlane.enable')}
      icon={<CutPlaneIcon />}
      readout={`${meters}${t('cutPlane.unitMeters')}`}
      label={t('cutPlane.label')}
      min={range.minMm}
      max={range.maxMm}
      step={CUT_PLANE_STEP_MM}
      value={value}
      ariaSlider={t('cutPlane.ariaSlider')}
      onValueChange={(v) => handleSlider([v])}
      positionClassName={`right-3 bottom-14 w-12 ${className}`}
    />
  );
});

/**
 * Horizontal-section glyph: a building/box whose LOWER half is filled (the poché kept
 * below the cut) while the upper half is an empty outline (removed above the cut), with a
 * bold cut line through the middle that overshoots both sides — the classic "plan cut"
 * marker. Reads clearly at 16px, unlike the previous faint isometric prism.
 */
function CutPlaneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {/* Solid lower half — material kept below the cut */}
      <path d="M3.5 8H12.5V12C12.5 12.83 11.83 13.5 11 13.5H5C4.17 13.5 3.5 12.83 3.5 12V8Z" fill="currentColor" fillOpacity="0.3" />
      {/* Full box outline */}
      <rect x="3.5" y="2.5" width="9" height="11" rx="1.2" stroke="currentColor" strokeWidth="1.1" />
      {/* The horizontal cut plane — bold, overshoots the box on both sides */}
      <path d="M1.5 8H14.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
