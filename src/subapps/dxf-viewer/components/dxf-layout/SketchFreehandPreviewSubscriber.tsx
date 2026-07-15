/**
 * ⚠️ ARCHITECTURE-CRITICAL — part of ADR-040 micro-leaf pattern (ADR-658 M1).
 * Subscribes to SketchFreehandStore only. Only this component re-renders on trace
 * point add. Shell (CanvasLayerStack) MUST NOT call useSyncExternalStore — keep it here.
 */
'use client';

import React, { useSyncExternalStore } from 'react';
import { SketchFreehandStore } from '../../systems/sketch/SketchFreehandStore';
import { freehandScreenGeometry } from './freehand-preview-projection';
import type { ViewTransform } from '../../rendering/types/Types';
import { PANEL_LAYOUT } from '../../config/panel-tokens';

interface SketchFreehandPreviewSubscriberProps {
  transform: ViewTransform;
  viewport: { width: number; height: number };
  className?: string;
}

// Module-level stable accessors (ADR-040 pattern)
const _getSnapshot = () => SketchFreehandStore.getSnapshot();
const _subscribe = (cb: () => void) => SketchFreehandStore.subscribe(cb);

/**
 * Renders the in-progress «Μολύβι» freehand stroke as a live white polyline, plus the
 * D5 auto-close affordance (ring at the start + dashed closing segment) when the cursor
 * nears the start. Points stream in via pointermove → re-renders at move frequency.
 */
export const SketchFreehandPreviewSubscriber = React.memo(function SketchFreehandPreviewSubscriber({
  transform, viewport, className,
}: SketchFreehandPreviewSubscriberProps) {
  const { points, nearClose } = useSyncExternalStore(_subscribe, _getSnapshot);

  const geo = freehandScreenGeometry(points, transform, viewport);
  if (!geo) return null;

  const stroke = PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE;
  const { polylineStr, first, last } = geo;

  return (
    <svg className={className} overflow="visible">
      <polyline
        points={polylineStr}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {nearClose && points.length >= 3 && (
        <line
          x1={last.x} y1={last.y} x2={first.x} y2={first.y}
          stroke={stroke} strokeWidth={1} strokeDasharray="4 4" strokeOpacity={0.8}
        />
      )}
      {nearClose && (
        <circle cx={first.x} cy={first.y} r={10} fill="none" stroke={stroke} strokeWidth={1.5} strokeOpacity={0.7} />
      )}
    </svg>
  );
});
