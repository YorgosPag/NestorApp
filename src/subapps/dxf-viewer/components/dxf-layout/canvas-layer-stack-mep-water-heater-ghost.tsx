/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * MepWaterHeaterGhostPreviewMount (ADR-408 DHW) — micro-leaf for the 2D domestic hot
 * water heater placement ghost. Mirror of `MepBoilerGhostPreviewMount`. Subscribes
 * internally to the cursor world position store (`useMepWaterHeaterGhostPreview`) so
 * CanvasSection does NOT re-render on mousemove.
 */

'use client';

import React from 'react';
import { useMepWaterHeaterGhostPreview } from '../../hooks/tools/useMepWaterHeaterGhostPreview';
import type { Point3D } from '../../bim/types/bim-base';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';

export interface MepWaterHeaterGhostPreviewMountProps {
  isAwaitingPosition: boolean;
  getGhostFootprint: (cursorPos: Readonly<Point2D> | null) => readonly Point3D[] | null;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const MepWaterHeaterGhostPreviewMount = React.memo(function MepWaterHeaterGhostPreviewMount(
  props: MepWaterHeaterGhostPreviewMountProps,
) {
  useMepWaterHeaterGhostPreview(props);
  return null;
});
