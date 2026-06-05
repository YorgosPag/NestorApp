/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * MepRadiatorGhostPreviewMount (ADR-408 Εύρος Β) — micro-leaf for the 2D heating
 * radiator placement ghost. Mirror of `MepManifoldGhostPreviewMount`. Subscribes
 * internally to the cursor world position store (`useMepRadiatorGhostPreview`) so
 * CanvasSection does NOT re-render on mousemove.
 */

'use client';

import React from 'react';
import { useMepRadiatorGhostPreview } from '../../hooks/tools/useMepRadiatorGhostPreview';
import type { Point3D } from '../../bim/types/bim-base';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';

export interface MepRadiatorGhostPreviewMountProps {
  isAwaitingPosition: boolean;
  getGhostFootprint: (cursorPos: Readonly<Point2D> | null) => readonly Point3D[] | null;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const MepRadiatorGhostPreviewMount = React.memo(function MepRadiatorGhostPreviewMount(
  props: MepRadiatorGhostPreviewMountProps,
) {
  useMepRadiatorGhostPreview(props);
  return null;
});
