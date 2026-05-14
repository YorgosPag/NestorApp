/**
 * ⚠️ ARCHITECTURE-CRITICAL — part of ADR-040 micro-leaf pattern.
 * Subscribes to LassoCropStore + ImmediateSnapStore.
 * Only this component re-renders on lasso point add / snap change.
 * Shell (CanvasLayerStack) MUST NOT call useSyncExternalStore — keep it here.
 */
'use client';

import React, { useSyncExternalStore } from 'react';
import { LassoCropStore } from '../../systems/lasso/LassoCropStore';
import { subscribeSnapResult, getFullSnapResult } from '../../systems/cursor/ImmediateSnapStore';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';

interface LassoCropPreviewSubscriberProps {
  transform: ViewTransform;
  viewport: { width: number; height: number };
  className?: string;
}

// Module-level stable accessors — avoids closure churn per render (ADR-040 pattern)
const _getLassoPoints = () => LassoCropStore.getPoints();
const _subscribeLasso = (cb: () => void) => LassoCropStore.subscribe(cb);

/**
 * Renders the in-progress lasso polygon as an SVG overlay.
 * Updates only on click (low-freq) or snap change (high-freq, but cheap SVG redraw).
 */
export const LassoCropPreviewSubscriber = React.memo(function LassoCropPreviewSubscriber({
  transform, viewport, className,
}: LassoCropPreviewSubscriberProps) {
  const points = useSyncExternalStore(_subscribeLasso, _getLassoPoints);
  const snapResult = useSyncExternalStore(subscribeSnapResult, getFullSnapResult);

  if (points.length === 0) return null;

  const toScreen = (wx: number, wy: number): Point2D =>
    CoordinateTransforms.worldToScreen({ x: wx, y: wy }, transform, viewport);

  const screenPts = points.map(([wx, wy]) => toScreen(wx, wy));
  const polylineStr = screenPts.map(p => `${p.x},${p.y}`).join(' ');

  const cursorScreen = snapResult
    ? CoordinateTransforms.worldToScreen(snapResult.snappedPoint, transform, viewport)
    : null;

  const last = screenPts[screenPts.length - 1];
  const first = screenPts[0];

  return (
    <svg className={className} overflow="visible">
      <polygon
        points={polylineStr}
        fill="rgba(255, 140, 0, 0.08)"
        stroke="#ff8c00"
        strokeWidth={1.5}
        strokeDasharray="6 3"
        strokeLinejoin="round"
      />
      {cursorScreen && (
        <line
          x1={last.x} y1={last.y}
          x2={cursorScreen.x} y2={cursorScreen.y}
          stroke="#ff8c00" strokeWidth={1.5} strokeDasharray="4 4" strokeOpacity={0.7}
        />
      )}
      {cursorScreen && points.length >= 2 && (
        <line
          x1={cursorScreen.x} y1={cursorScreen.y}
          x2={first.x} y2={first.y}
          stroke="#ff8c00" strokeWidth={1} strokeDasharray="2 4" strokeOpacity={0.35}
        />
      )}
      {screenPts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === 0 ? 5 : 3} fill="#ff8c00" />
      ))}
    </svg>
  );
});
