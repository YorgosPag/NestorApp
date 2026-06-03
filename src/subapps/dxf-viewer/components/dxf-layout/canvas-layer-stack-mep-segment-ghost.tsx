/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * MepSegmentGhostPreviewMount (ADR-408 Φ8) — micro-leaf for the 2D MEP
 * segment rubber-band ghost (duct / pipe 2-click placement). Mirror of
 * `MepFixtureGhostPreviewMount` / `ElectricalPanelGhostPreviewMount`.
 *
 * Subscribes internally to the cursor world-position store
 * (`useMepSegmentGhostPreview`) so CanvasSection does NOT re-render on
 * mousemove. Active only during `isAwaitingEnd` (first click done, awaiting
 * second). The parent passes `getGhostSegment` which supplies the fixed start
 * point + current section width; the hook reads the live cursor internally.
 */

'use client';

import React from 'react';
import {
  useMepSegmentGhostPreview,
  type UseMepSegmentGhostPreviewProps,
  type GhostSegmentSpec,
} from '../../hooks/tools/useMepSegmentGhostPreview';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';

export interface MepSegmentGhostPreviewMountProps {
  /** True while awaiting the second click (end point). */
  isAwaitingEnd: boolean;
  /**
   * Returns the spec for the ghost (start point + section width + domain), or
   * null when no ghost should be drawn. Called each RAF frame.
   */
  getGhostSegment: (cursorPos: Readonly<Point2D> | null) => GhostSegmentSpec | null;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const MepSegmentGhostPreviewMount = React.memo(function MepSegmentGhostPreviewMount(
  props: MepSegmentGhostPreviewMountProps,
) {
  const hookProps: UseMepSegmentGhostPreviewProps = {
    isAwaitingEnd: props.isAwaitingEnd,
    transform: props.transform,
    getGhostSegment: props.getGhostSegment,
    getCanvas: props.getCanvas,
    getViewportElement: props.getViewportElement,
  };
  useMepSegmentGhostPreview(hookProps);
  return null;
});

// Re-export GhostSegmentSpec for convenience (callers import from this module).
export type { GhostSegmentSpec };
