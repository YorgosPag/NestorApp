'use client';

import React, { useSyncExternalStore } from 'react';
import {
  subscribeRegionPerimeterPreview,
  getRegionPerimeterPreview,
} from '../../systems/region-preview/RegionPerimeterPreviewStore';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';

interface Props {
  transform: ViewTransform;
  viewport: { width: number; height: number };
}

/**
 * ADR-419 Layer 3 — SVG overlay που δείχνει το ανιχνευμένο περίγραμμα κάτω από τον
 * κέρσορα όταν είναι ενεργό εργαλείο «σε περιοχή / από περίγραμμα» (κολώνες +
 * τοίχοι), Revit «Finish Sketch» feedback. Πράσινο = έγκυρο μέλος· κόκκινο =
 * πολύ μεγάλο (εξωτερικό περίγραμμα → δεν θα δημιουργηθεί). Δείχνει διαστάσεις.
 *
 * ADR-040 compliant: standalone subscriber (useSyncExternalStore στο leaf, όχι στο
 * shell). Mirror του `AutoAreaPreviewOverlay`.
 */
export function RegionPerimeterPreviewOverlay({ transform, viewport }: Props) {
  const preview = useSyncExternalStore(
    subscribeRegionPerimeterPreview,
    getRegionPerimeterPreview,
    getRegionPerimeterPreview,
  );

  if (!preview || preview.polygon.length < 3) return null;

  const screenPts = preview.polygon.map((p) =>
    CoordinateTransforms.worldToScreen(p, transform, viewport),
  );
  const d =
    screenPts
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ') + ' Z';

  const color = preview.oversized ? '#ef4444' : '#22c55e';
  const fill = preview.oversized ? 'rgba(239,68,68,0.10)' : 'rgba(34,197,94,0.12)';
  const centroid: Point2D = screenPts.reduce(
    (acc, p) => ({ x: acc.x + p.x / screenPts.length, y: acc.y + p.y / screenPts.length }),
    { x: 0, y: 0 },
  );

  return (
    <svg
      className="absolute inset-0 size-full pointer-events-none z-10"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={d}
        fill={fill}
        stroke={color}
        strokeWidth="2"
        strokeDasharray="8 4"
        strokeLinejoin="round"
      />
      <text
        x={centroid.x}
        y={centroid.y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="12"
        fontWeight="600"
        fill={color}
        stroke="#0b0f19"
        strokeWidth="0.5"
        paintOrder="stroke"
      >
        {preview.label}
      </text>
    </svg>
  );
}
