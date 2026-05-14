/**
 * ⚠️ ARCHITECTURE-CRITICAL — part of ADR-040 micro-leaf pattern.
 * Subscribes to LassoFreehandStore only.
 * Only this component re-renders on lasso point add.
 * Shell (CanvasLayerStack) MUST NOT call useSyncExternalStore — keep it here.
 */
'use client';

import React, { useSyncExternalStore } from 'react';
import { LassoFreehandStore } from '../../systems/lasso/LassoFreehandStore';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';

interface LassoFreehandPreviewSubscriberProps {
  transform: ViewTransform;
  viewport: { width: number; height: number };
  className?: string;
}

// Module-level stable accessors (ADR-040 pattern)
const _getSnapshot = () => LassoFreehandStore.getSnapshot();
const _subscribe = (cb: () => void) => LassoFreehandStore.subscribe(cb);

/**
 * Renders the in-progress freehand lasso as a dashed SVG polyline.
 * Teal colour distinguishes it from polygon-crop (orange).
 * Points stream in via mousemove, so this re-renders at move frequency.
 */
export const LassoFreehandPreviewSubscriber = React.memo(function LassoFreehandPreviewSubscriber({
  transform, viewport, className,
}: LassoFreehandPreviewSubscriberProps) {
  const { points, nearClose } = useSyncExternalStore(_subscribe, _getSnapshot);

  if (points.length < 2) return null;

  const toScreen = (wx: number, wy: number): Point2D =>
    CoordinateTransforms.worldToScreen({ x: wx, y: wy }, transform, viewport);

  const screenPts = points.map(([wx, wy]) => toScreen(wx, wy));
  const polylineStr = screenPts.map(p => `${p.x},${p.y}`).join(' ');
  const first = screenPts[0];
  const last = screenPts[screenPts.length - 1];

  return (
    <svg className={className} overflow="visible">
      <polyline
        points={polylineStr}
        fill="none"
        stroke="#0e7490"
        strokeWidth={1.5}
        strokeDasharray="5 3"
        strokeLinejoin="round"
      />
      {points.length >= 3 && (
        <line
          x1={last.x} y1={last.y}
          x2={first.x} y2={first.y}
          stroke="#0e7490" strokeWidth={1} strokeDasharray="2 4" strokeOpacity={nearClose ? 0.9 : 0.4}
        />
      )}
      {/* Snap-to-close: outer ring when near start */}
      {nearClose && (
        <circle cx={first.x} cy={first.y} r={14} fill="none" stroke="#0e7490" strokeWidth={1.5} strokeOpacity={0.5} />
      )}
      <circle
        cx={first.x} cy={first.y}
        r={nearClose ? 8 : 5}
        fill="#0e7490"
        fillOpacity={nearClose ? 1 : 0.8}
        style={{ transition: 'r 0.1s ease' }}
      />
    </svg>
  );
});
