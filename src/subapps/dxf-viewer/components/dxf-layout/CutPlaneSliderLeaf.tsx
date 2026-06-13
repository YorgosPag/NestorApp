'use client';

// ============================================================================
// ✂️ CutPlaneSliderLeaf — ADR-452 micro-leaf (2D mount of the cut-plane slider)
// ============================================================================
//
// Thin 2D-gated wrapper around <CutPlaneSliderControl>. Self-gates to 2D via
// ViewMode3DStore (ADR-040: the ONLY subscriber here; CanvasLayerStack just mounts
// it). The 3D mount lives in BimViewport3D (CutPlaneSlider3DLeaf). Both share the
// single cut-plane SSoT, so the slider position carries across modes.
// ============================================================================

import React, { useSyncExternalStore } from 'react';
import { useViewMode3DStore } from '../../bim-3d/stores/ViewMode3DStore';
import { CutPlaneSliderControl } from './CutPlaneSliderControl';

const subscribeMode = (listener: () => void) => useViewMode3DStore.subscribe(listener);
const getModeIs2D = () => useViewMode3DStore.getState().mode === '2d';
const getModeIs2DSSR = () => false;

export const CutPlaneSliderLeaf = React.memo(function CutPlaneSliderLeaf() {
  const is2D = useSyncExternalStore(subscribeMode, getModeIs2D, getModeIs2DSSR);
  if (!is2D) return null;
  return <CutPlaneSliderControl className="z-30" />;
});
