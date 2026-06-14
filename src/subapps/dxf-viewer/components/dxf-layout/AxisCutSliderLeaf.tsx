'use client';

// ============================================================================
// ✂️ AxisCutSliderLeaf — ADR-455 micro-leaf (2D mount of the X/Y section sliders)
// ============================================================================
//
// Thin 2D-gated wrapper that mounts the two vertical section-cut controls: the X cut
// along the canvas BASE (above the horizontal ruler) and the Y cut along the canvas
// LEFT (right of the vertical ruler). Self-gates to 2D via ViewMode3DStore (ADR-040:
// the ONLY subscriber here). The 3D mount lives in BimViewport3D (AxisCutSlider3DLeaf).
// Both share the single axis-cut SSoT. Range = the loaded model's world extent.
// ============================================================================

import React, { useMemo, useSyncExternalStore } from 'react';
import { useViewMode3DStore } from '../../bim-3d/stores/ViewMode3DStore';
import type { Point2D } from '../../rendering/types/Types';
import { AxisCutSliderControl } from './AxisCutSliderControl';
import { computeAxisCutRange } from './axis-cut-range';

export interface AxisCutSliderLeafProps {
  /** Loaded model world bounds (scene/canvas units), or null before a file loads. */
  readonly bounds: { min: Point2D; max: Point2D } | null;
}

const subscribeMode = (listener: () => void) => useViewMode3DStore.subscribe(listener);
const getModeIs2D = () => useViewMode3DStore.getState().mode === '2d';
const getModeIs2DSSR = () => false;

export const AxisCutSliderLeaf = React.memo(function AxisCutSliderLeaf({ bounds }: AxisCutSliderLeafProps) {
  const is2D = useSyncExternalStore(subscribeMode, getModeIs2D, getModeIs2DSSR);
  const xRange = useMemo(() => computeAxisCutRange(bounds?.min.x, bounds?.max.x), [bounds]);
  const yRange = useMemo(() => computeAxisCutRange(bounds?.min.y, bounds?.max.y), [bounds]);

  if (!is2D) return null;

  // ADR-455 redesign — compact corner widgets (toggle + flip + readout). The cut
  // position is dragged on the on-canvas handle that sits on the section line, so these
  // no longer stretch along the canvas edge as a slider track.
  return (
    <>
      <AxisCutSliderControl axis="x" range={xRange} className="bottom-[34px] left-[88px] z-30" />
      <AxisCutSliderControl axis="y" range={yRange} className="left-[34px] top-16 z-30" />
    </>
  );
});
