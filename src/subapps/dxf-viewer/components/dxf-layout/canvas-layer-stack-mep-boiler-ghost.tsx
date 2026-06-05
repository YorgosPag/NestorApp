/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * MepBoilerGhostPreviewMount (ADR-408 Εύρος Β #2) — micro-leaf for the 2D heating
 * boiler placement ghost. Mirror of `MepRadiatorGhostPreviewMount`. Subscribes
 * internally to the cursor world position store (`useMepBoilerGhostPreview`) so
 * CanvasSection does NOT re-render on mousemove.
 */

'use client';

import React from 'react';
import { useMepBoilerGhostPreview } from '../../hooks/tools/useMepBoilerGhostPreview';
import type { Point3D } from '../../bim/types/bim-base';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';

export interface MepBoilerGhostPreviewMountProps {
  isAwaitingPosition: boolean;
  getGhostFootprint: (cursorPos: Readonly<Point2D> | null) => readonly Point3D[] | null;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const MepBoilerGhostPreviewMount = React.memo(function MepBoilerGhostPreviewMount(
  props: MepBoilerGhostPreviewMountProps,
) {
  useMepBoilerGhostPreview(props);
  return null;
});
