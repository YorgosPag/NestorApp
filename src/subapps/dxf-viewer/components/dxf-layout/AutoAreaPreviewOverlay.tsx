'use client';

import React, { useSyncExternalStore } from 'react';
import { subscribeAutoAreaPreview, getAutoAreaPreview } from '../../systems/auto-area/AutoAreaPreviewStore';
// ADR-040 Phase XXII.B — δικό του transform subscription (leaf), όχι prop από τον shell.
import { useTransformValue } from '../../systems/cursor/ImmediateTransformStore';
import type { Point2D, Viewport } from '../../rendering/types/Types';
// ADR-911 Φ3β — η μετατροπή κόσμου → SVG path έχει ένα σπίτι (ήταν αντίγραφο σε τρία overlays).
import { worldRingToSvgPath } from './preview-zone/world-ring-path';

interface Props {
  viewport: Viewport;
}

/**
 * SVG overlay that highlights the detected region under the cursor while
 * activeTool === 'auto-measure-area'. Uses fill-rule="evenodd" so that hole
 * polygons create transparent cutouts (donut/annulus visual).
 * ADR-040 compliant: standalone subscriber — no useSyncExternalStore in shell.
 */
export function AutoAreaPreviewOverlay({ viewport }: Props) {
  const preview = useSyncExternalStore(
    subscribeAutoAreaPreview,
    getAutoAreaPreview,
    getAutoAreaPreview,
  );
  // ADR-040 Phase XXII.B — leaf-level transform (κοστίζει μόνο όσο υπάρχει preview).
  const transform = useTransformValue();

  if (!preview || preview.polygon.length < 3) return null;

  const toScreenPath = (polygon: Point2D[]): string => worldRingToSvgPath(polygon, transform, viewport);

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
