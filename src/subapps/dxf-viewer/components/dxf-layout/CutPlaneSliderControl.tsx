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
import { Slider } from '@/components/ui/slider';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import { useCutPlaneRange, type CutPlaneRange } from './useCutPlaneRange';
// ADR-366 — the 2D canvas hides its native cursor + tracks an SSoT crosshair; an
// overlay child swallows onMouseLeave so the crosshair freezes. Clearing on enter
// fixes it (no-op in 3D, where there is no 2D crosshair).
import { setImmediatePosition } from '../../systems/cursor/ImmediatePositionStore';

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
    <aside
      onMouseEnter={() => setImmediatePosition(null)}
      className={`cut-plane-slider-accent pointer-events-auto absolute right-3 bottom-14 flex w-12 cursor-default flex-col items-center gap-2 ${className}`}
    >
      <button
        type="button"
        onClick={handleToggle}
        aria-label={active ? t('cutPlane.disable') : t('cutPlane.enable')}
        aria-pressed={active}
        className={`flex cursor-pointer select-none items-center justify-center rounded border p-1.5 shadow-md backdrop-blur-sm transition-colors ${
          active
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-background/80 text-foreground hover:bg-accent hover:text-accent-foreground'
        }`}
      >
        <CutPlaneIcon />
      </button>
      <output className="rounded bg-background/80 px-1 py-0.5 text-[10px] font-semibold tabular-nums text-foreground shadow-sm backdrop-blur-sm">
        {meters}
        {t('cutPlane.unitMeters')}
      </output>
      <Slider
        orientation="vertical"
        aria-label={t('cutPlane.ariaSlider')}
        className="my-1 flex-1 cursor-pointer [&_[role=slider]]:cursor-grab [&_[role=slider]]:active:cursor-grabbing"
        min={range.minMm}
        max={range.maxMm}
        step={CUT_PLANE_STEP_MM}
        value={[value]}
        onValueChange={handleSlider}
      />
      <span className="select-none text-[9px] font-medium text-muted-foreground" aria-hidden="true">
        {t('cutPlane.label')}
      </span>
    </aside>
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
