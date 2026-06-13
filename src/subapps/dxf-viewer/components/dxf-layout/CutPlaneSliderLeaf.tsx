'use client';

// ============================================================================
// ✂️ CutPlaneSliderLeaf — ADR-452 micro-leaf (right-edge cut-plane slider)
// ============================================================================
//
// Revit View Range / Cut Plane control for the 2D plan: a vertical slider on the
// right edge that drives `viewRange.cutPlaneMm`. Moving it re-renders the plan in
// real time, hiding BIM entities whose base sits above the cut elevation (the
// hide gate lives in `DxfRenderer.isEntityLayerSkipped` via `isHiddenByCutPlane`).
//
// ADR-040: this leaf is the ONLY subscriber here — `CanvasLayerStack` just mounts
// it. Subscribes to `ViewMode3DStore` (2D-gate) and the low-freq render-settings
// store. Slider drag writes to the store (debounced Firestore persist).
// ============================================================================

import React, { useSyncExternalStore } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Slider } from '@/components/ui/slider';
import { useViewMode3DStore } from '../../bim-3d/stores/ViewMode3DStore';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import { useCutPlaneRange, type CutPlaneRange } from './useCutPlaneRange';
// ADR-366 — the canvas container hides its native cursor (`cursor-none`) and tracks
// an SSoT crosshair position; an overlay child swallows the container's onMouseLeave,
// so the crosshair freezes. Clear the position on enter (same fix as the 3D toggle).
import { setImmediatePosition } from '../../systems/cursor/ImmediatePositionStore';

const subscribeMode = (listener: () => void) => useViewMode3DStore.subscribe(listener);
const getModeIs2D = () => useViewMode3DStore.getState().mode === '2d';
const getModeIs2DSSR = () => false;

const CUT_PLANE_STEP_MM = 10;

/** Clamp the persisted cut elevation into the building's slider range. */
function clampToRange(mm: number, range: CutPlaneRange): number {
  return Math.min(range.maxMm, Math.max(range.minMm, mm));
}

export const CutPlaneSliderLeaf = React.memo(function CutPlaneSliderLeaf() {
  const { t } = useTranslation('dxf-viewer-panels');
  const is2D = useSyncExternalStore(subscribeMode, getModeIs2D, getModeIs2DSSR);
  const active = useBimRenderSettingsStore((s) => s.cutPlaneActive);
  const cutMm = useBimRenderSettingsStore((s) => s.viewRange.cutPlaneMm);
  const range = useCutPlaneRange();

  // Only in 2D, and only when the building's vertical range is known.
  if (!is2D || !range) return null;

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
    // Enabling «from scratch» starts at the active storey ceiling → full plan first.
    if (next) setCut(range.defaultMm);
  };

  const meters = (value / 1000).toFixed(2);

  return (
    <aside
      onMouseEnter={() => setImmediatePosition(null)}
      className="pointer-events-auto absolute right-3 top-14 bottom-14 z-30 flex w-12 cursor-default flex-col items-center gap-2"
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
