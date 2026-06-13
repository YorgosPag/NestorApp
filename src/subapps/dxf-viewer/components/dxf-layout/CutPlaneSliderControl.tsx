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
  /** z-index / stacking class for the host (`z-30` in 2D, `z-[60]` above the 3D canvas). */
  readonly className?: string;
}

export const CutPlaneSliderControl = React.memo(function CutPlaneSliderControl({
  className = 'z-30',
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
      className={`pointer-events-auto absolute right-3 top-14 bottom-14 flex w-12 cursor-default flex-col items-center gap-2 ${className}`}
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

/** Horizontal-section glyph (a plane slicing a box). */
function CutPlaneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 4.5L8 2L13 4.5V10L8 12.5L3 10V4.5Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" strokeOpacity="0.6" />
      <path d="M1.5 7.5H14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
