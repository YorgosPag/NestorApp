/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * MepManifoldGhostPreviewMount (ADR-408 Φ12) — micro-leaf for the 2D
 * plumbing manifold placement ghost. Mirror of `ElectricalPanelGhostPreviewMount`.
 * Subscribes internally to the cursor world position store
 * (`useMepManifoldGhostPreview`) so CanvasSection does NOT re-render on
 * mousemove.
 */

'use client';

import React from 'react';
import { useMepManifoldGhostPreview } from '../../hooks/tools/useMepManifoldGhostPreview';
import type { Point3D } from '../../bim/types/bim-base';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';

export interface MepManifoldGhostPreviewMountProps {
  isAwaitingPosition: boolean;
  getGhostFootprint: (cursorPos: Readonly<Point2D> | null) => readonly Point3D[] | null;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const MepManifoldGhostPreviewMount = React.memo(function MepManifoldGhostPreviewMount(
  props: MepManifoldGhostPreviewMountProps,
) {
  useMepManifoldGhostPreview(props);
  return null;
});
