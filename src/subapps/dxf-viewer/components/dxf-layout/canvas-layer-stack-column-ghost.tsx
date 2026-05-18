/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ColumnGhostPreviewMount (ADR-363 Phase 4.5c.1) — micro-leaf για το column
 * anchor ghost preview. Extracted από canvas-layer-stack-leaves.tsx για να
 * κρατηθεί ο shell <500 lines (Google SRP / N.7.1).
 *
 * Subscribes εσωτερικά στο cursor world position store (useColumnGhostPreview)
 * — CanvasSection δεν re-renderάρει σε mousemove.
 */

'use client';

import React from 'react';
import { useColumnGhostPreview } from '../../hooks/tools/useColumnGhostPreview';
import type { ColumnKind } from '../../bim/types/column-types';
import type { AnchorGhost } from '../../bim/columns/column-anchor-ghosts';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';

export interface ColumnGhostPreviewMountProps {
  isAwaitingPosition: boolean;
  kind: ColumnKind;
  getGhostFootprints: (cursorPos: Readonly<Point2D> | null) => readonly AnchorGhost[] | null;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const ColumnGhostPreviewMount = React.memo(function ColumnGhostPreviewMount(
  props: ColumnGhostPreviewMountProps,
) {
  useColumnGhostPreview(props);
  return null;
});
