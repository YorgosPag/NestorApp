'use client';

import React, { useSyncExternalStore } from 'react';
import {
  subscribeRegionGapMarkers,
  getRegionGapMarkers,
} from '../../systems/region-preview/RegionGapMarkersStore';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import type { ViewTransform } from '../../rendering/types/Types';

interface Props {
  transform: ViewTransform;
  viewport: { width: number; height: number };
}

/** Ακτίνα του gap marker σε pixels (σταθερή, screen-space — σαν AutoCAD). */
const GAP_MARKER_RADIUS_PX = 7;
const GAP_MARKER_COLOR = '#ef4444';

/**
 * ADR-419 Layer 5b — SVG overlay που σημαδεύει με κόκκινους κύκλους τα ανοιχτά άκρα
 * (gap endpoints) όταν ένα region/perimeter pick δεν κλείνει βρόχο. AutoCAD
 * `BOUNDARY` red-circles feedback: δείχνει ΠΟΥ λείπει η ένωση.
 *
 * ADR-040 compliant: standalone leaf subscriber (useSyncExternalStore, zero shell
 * subscription). Mirror του `RegionPerimeterPreviewOverlay`. Λευκό halo κάτω από τον
 * κόκκινο δακτύλιο για ορατότητα πάνω σε σκουρόχρωμο/ανοιχτό σχέδιο.
 */
export function RegionGapMarkersOverlay({ transform, viewport }: Props) {
  const markers = useSyncExternalStore(
    subscribeRegionGapMarkers,
    getRegionGapMarkers,
    getRegionGapMarkers,
  );

  if (markers.length === 0) return null;

  const screenPts = markers.map((p) =>
    CoordinateTransforms.worldToScreen(p, transform, viewport),
  );

  return (
    <svg
      className="absolute inset-0 size-full pointer-events-none z-10"
      xmlns="http://www.w3.org/2000/svg"
    >
      {screenPts.map((p, i) => (
        <g key={i}>
          <circle
            cx={p.x.toFixed(1)}
            cy={p.y.toFixed(1)}
            r={GAP_MARKER_RADIUS_PX + 1}
            fill="none"
            stroke="#0b0f19"
            strokeWidth="4"
            opacity="0.5"
          />
          <circle
            cx={p.x.toFixed(1)}
            cy={p.y.toFixed(1)}
            r={GAP_MARKER_RADIUS_PX}
            fill="none"
            stroke={GAP_MARKER_COLOR}
            strokeWidth="2"
          />
        </g>
      ))}
    </svg>
  );
}
