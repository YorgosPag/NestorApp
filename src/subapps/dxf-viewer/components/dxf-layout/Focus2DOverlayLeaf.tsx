'use client';

// ============================================================================
// ♿ Focus2DOverlayLeaf — micro-leaf wrapper (ADR-366 Phase 4.6 / A.7.Q1)
// ============================================================================
//
// Bridges the cross-mode `ViewMode3DStore.mode` into `Focus2DOverlay`'s
// `active` prop. Subscribes to the store ONLY here (low-freq, single bool
// derive) so the parent `CanvasLayerStack` shell stays subscription-free per
// ADR-040 cardinal rule #1.
// ============================================================================

import React, { useSyncExternalStore } from 'react';
import { useViewMode3DStore } from '../../bim-3d/stores/ViewMode3DStore';
import { Focus2DOverlay } from '../../accessibility/Focus2DOverlay';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';

const subscribeMode = (listener: () => void) => useViewMode3DStore.subscribe(listener);
const getModeIs2D = () => useViewMode3DStore.getState().mode === '2d';
const getModeIs2DSSR = () => true;

export interface Focus2DOverlayLeafProps {
  readonly scene: DxfScene | null;
  readonly transform: ViewTransform;
  readonly viewport: Viewport;
}

export const Focus2DOverlayLeaf = React.memo(function Focus2DOverlayLeaf({
  scene,
  transform,
  viewport,
}: Focus2DOverlayLeafProps) {
  const is2D = useSyncExternalStore(subscribeMode, getModeIs2D, getModeIs2DSSR);
  return (
    <Focus2DOverlay
      scene={scene}
      transform={transform}
      viewport={viewport}
      active={is2D}
    />
  );
});
