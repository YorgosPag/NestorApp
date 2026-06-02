/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * MepFixtureGhostPreviewMount (ADR-406) — micro-leaf for the 2D MEP fixture
 * placement ghost. Mirror of `ColumnGhostPreviewMount`. Subscribes internally to
 * the cursor world position store (`useMepFixtureGhostPreview`) so CanvasSection
 * does NOT re-render on mousemove.
 */

'use client';

import React from 'react';
import { useMepFixtureGhostPreview } from '../../hooks/tools/useMepFixtureGhostPreview';
import type { Point3D } from '../../bim/types/bim-base';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';

export interface MepFixtureGhostPreviewMountProps {
  isAwaitingPosition: boolean;
  getGhostFootprint: (cursorPos: Readonly<Point2D> | null) => readonly Point3D[] | null;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const MepFixtureGhostPreviewMount = React.memo(function MepFixtureGhostPreviewMount(
  props: MepFixtureGhostPreviewMountProps,
) {
  useMepFixtureGhostPreview(props);
  return null;
});
