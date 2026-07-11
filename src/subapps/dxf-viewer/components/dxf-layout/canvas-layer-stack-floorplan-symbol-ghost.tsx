/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * FloorplanSymbolGhostPreviewMount (ADR-415) — micro-leaf for the 2D floorplan
 * symbol placement ghost. Mirror of `MepFixtureGhostPreviewMount`. Subscribes
 * internally to the cursor world position store (`useFloorplanSymbolGhostPreview`)
 * so CanvasSection does NOT re-render on mousemove.
 */

'use client';

import React from 'react';
import { useFloorplanSymbolGhostPreview } from '../../hooks/tools/useFloorplanSymbolGhostPreview';
import type { Point3D } from '../../bim/types/bim-base';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';

export interface FloorplanSymbolGhostPreviewMountProps {
  isAwaitingPosition: boolean;
  getGhostFootprint: (cursorPos: Readonly<Point2D> | null) => readonly Point3D[] | null;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const FloorplanSymbolGhostPreviewMount = React.memo(function FloorplanSymbolGhostPreviewMount(
  props: FloorplanSymbolGhostPreviewMountProps,
) {
  useFloorplanSymbolGhostPreview(props);
  return null;
});
