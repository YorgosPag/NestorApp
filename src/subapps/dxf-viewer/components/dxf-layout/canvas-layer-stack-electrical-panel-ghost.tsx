/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ElectricalPanelGhostPreviewMount (ADR-408 Φ3) — micro-leaf for the 2D
 * electrical panel placement ghost. Mirror of `MepFixtureGhostPreviewMount`.
 * Subscribes internally to the cursor world position store
 * (`useElectricalPanelGhostPreview`) so CanvasSection does NOT re-render on
 * mousemove.
 */

'use client';

import React from 'react';
import { useElectricalPanelGhostPreview } from '../../hooks/tools/useElectricalPanelGhostPreview';
import type { Point3D } from '../../bim/types/bim-base';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';

export interface ElectricalPanelGhostPreviewMountProps {
  isAwaitingPosition: boolean;
  getGhostFootprint: (cursorPos: Readonly<Point2D> | null) => readonly Point3D[] | null;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const ElectricalPanelGhostPreviewMount = React.memo(function ElectricalPanelGhostPreviewMount(
  props: ElectricalPanelGhostPreviewMountProps,
) {
  useElectricalPanelGhostPreview(props);
  return null;
});
