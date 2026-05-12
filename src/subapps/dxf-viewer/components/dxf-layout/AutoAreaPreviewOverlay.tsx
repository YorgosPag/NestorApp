'use client';

import React, { useSyncExternalStore } from 'react';
import { subscribeAutoAreaPreview, getAutoAreaPreview } from '../../systems/auto-area/AutoAreaPreviewStore';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';

interface Props {
  transform: ViewTransform;
  viewport: { width: number; height: number };
}

/**
 * SVG overlay that highlights the detected region under the cursor while
 * activeTool === 'auto-measure-area'. Uses fill-rule="evenodd" so that hole
 * polygons create transparent cutouts (donut/annulus visual).
 * ADR-040 compliant: standalone subscriber — no useSyncExternalStore in shell.
 */
export function AutoAreaPreviewOverlay({ transform, viewport }: Props) {
  const preview = useSyncExternalStore(
    subscribeAutoAreaPreview,
    getAutoAreaPreview,
    getAutoAreaPreview,
  );

  if (!preview || preview.polygon.length < 3) return null;

  const toScreenPath = (polygon: Point2D[]): string =>
    polygon
      .map(p => CoordinateTransforms.worldToScreen(p, transform, viewport))
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ') + ' Z';

  const outerPath = toScreenPath(preview.polygon);
  const holePaths = (preview.holes ?? [])
    .filter(h => h.length >= 3)
    .map(toScreenPath)
    .join(' ');

  const d = holePaths ? `${outerPath} ${holePaths}` : outerPath;

  return (
    <svg
      className="absolute inset-0 size-full pointer-events-none z-10"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={d}
        fillRule="evenodd"
        fill="rgba(59,130,246,0.10)"
        stroke="#3b82f6"
        strokeWidth="2"
        strokeDasharray="8 4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
