/**
 * ADR-920 §14.10 — «which contour is nearest to (x, y)?», over the snapshot's OWN contours. Pure.
 *
 * 🔑 **From `snapshot.contours`, never from the drawn paths**: the map merges every contour of a class into one path and,
 *   at `minorShown: 'none'`, draws no intermediate at all (Β6.9). The inspector answers with the contour of the SURFACE —
 *   the one the 3D shows and the stats count — and then lights it along its full length.
 * 🔑 **The search is not ours**: it is the shared `segment-nearest-index.ts` (bucket grid + ring search outward, O(1)
 *   amortised per pointer move) — the elevation mosaic asks the same question of the survey's rim (ADR-920 §14.12 Β3).
 *   This module owns only what is contour-specific: which contour a segment belongs to.
 *
 * @module lib/terrain/inspect/terrain-contour-index
 */

import { createSegmentNearestIndex, type PlanarSegment } from '@/lib/geometry/segment-nearest-index';
import type { ListingTerrainContour } from '@/lib/terrain/publication/listing-terrain-types';

/** The answer: which contour, its level and class, and how far the point is from it (plan metres). */
export interface NearestContour {
  readonly contour: number;
  readonly levelM: number;
  readonly major: boolean;
  readonly distanceM: number;
}

export interface ContourIndex {
  readonly nearest: (x: number, y: number) => NearestContour | null;
}

/** A straight piece of a contour, and the contour it belongs to. */
interface ContourPiece extends PlanarSegment {
  readonly contour: number;
}

/** Every straight piece of every contour; a closed contour gets its closing piece. */
function contourPiecesOf(contours: readonly ListingTerrainContour[]): ContourPiece[] {
  const out: ContourPiece[] = [];
  contours.forEach((contour, index) => {
    const p = contour.points;
    const count = Math.floor(p.length / 2);
    for (let i = 0; i + 1 < count; i++) {
      out.push({ contour: index, a: { x: p[2 * i], y: p[2 * i + 1] }, b: { x: p[2 * i + 2], y: p[2 * i + 3] } });
    }
    if (contour.closed && count > 2) {
      out.push({ contour: index, a: { x: p[2 * count - 2], y: p[2 * count - 1] }, b: { x: p[0], y: p[1] } });
    }
  });
  return out;
}

/** The index of a snapshot's contours. An empty list answers `null` everywhere. */
export function createContourIndex(contours: readonly ListingTerrainContour[]): ContourIndex {
  const pieces = contourPiecesOf(contours);
  const index = createSegmentNearestIndex(pieces);
  const nearest = (x: number, y: number): NearestContour | null => {
    const hit = index.nearest(x, y);
    if (hit === null) return null;
    const owner = pieces[hit.segment].contour;
    const contour = contours[owner];
    return { contour: owner, levelM: contour.levelM, major: contour.major, distanceM: hit.distance };
  };
  return { nearest };
}
