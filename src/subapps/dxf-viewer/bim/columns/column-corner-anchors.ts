/**
 * ADR-597 §5.4 — Column perimeter-corner world-point exposure (pure SSoT).
 *
 * Exposes the **4 diagonal (corner) anchors** of a BIM column as world-
 * coordinate snap targets: NE, NW, SE, SW. These are the corners of the
 * column footprint bounding box — the structural face-meeting points where
 * beams or walls terminate against a column.
 *
 * Implementation: thin filter over `getColumnAnchorWorldPoints()` (ADR-363
 * Phase 5.5d — existing SSoT for ALL 9 column anchors). This module keeps
 * only the 4 diagonal anchors:
 *
 *   rectangular / L-shape / T-shape → bbox corners (nw/ne/se/sw)
 *   circular → 45° perimeter points (nw/ne/se/sw at cos45°·r from center)
 *
 * Zero code duplication: NO re-implementation of the column geometry transform.
 * The full 9-anchor computation is already optimized and tested in
 * `column-anchors.ts`; this module is a semantic filter only.
 *
 * Pure module: zero React / DOM / Firestore / canvas deps. Idempotent.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-597-bim-corner-snap-system.md §5.4
 * @see bim/columns/column-anchors.ts  (SSoT source — getColumnAnchorWorldPoints)
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 5.5d
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ColumnEntity, ColumnParams } from '../types/column-types';
import {
  getColumnAnchorWorldPoints,
  getColumnAnchorWorldPointsFromParams,
} from './column-anchors';

// ─── Tagged result ─────────────────────────────────────────────────────────────

/** The 4 diagonal column corners (compass labels). */
export type ColumnCornerLabel = 'nw' | 'ne' | 'se' | 'sw';

/**
 * Tagged column corner world point.
 * `corner` enables downstream debug tooltips ("snapped to column NE corner").
 */
export interface ColumnCornerWorldPoint {
  readonly corner: ColumnCornerLabel;
  readonly point: Point2D;
}

/** The 4 diagonal anchor labels that correspond to column footprint corners. */
const CORNER_LABELS = new Set<ColumnCornerLabel>(['nw', 'ne', 'se', 'sw']);

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute the 4 perimeter-corner world points for a column entity.
 *
 * Returns exactly 4 entries — one per diagonal anchor — in ANCHOR_CYCLE_ORDER
 * subset order (nw → ne → se → sw, which mirrors the Tab cycling sequence of
 * the column-placement tool for predictable deterministic test assertions).
 *
 * Degenerate columns (width / depth ≤ 0) → all 4 collapse to `params.position`;
 * de-duplicated by the spatial index.
 */
export function getColumnCornerWorldPoints(
  column: Readonly<ColumnEntity>,
): readonly ColumnCornerWorldPoint[] {
  return filterCorners(getColumnAnchorWorldPoints(column));
}

/**
 * ADR-398 — params-based core of {@link getColumnCornerWorldPoints}. Used by the
 * corner-projection snap to derive the 4 diagonal corners of a PROPOSED column
 * (drag/draw preview params) without a full `ColumnEntity`. Delegates to the
 * shared 9-anchor SSoT — same filter, zero duplication.
 */
export function getColumnCornerWorldPointsFromParams(
  params: Readonly<ColumnParams>,
): readonly ColumnCornerWorldPoint[] {
  return filterCorners(getColumnAnchorWorldPointsFromParams(params));
}

function filterCorners(
  all: readonly { readonly anchor: string; readonly point: Point2D }[],
): readonly ColumnCornerWorldPoint[] {
  const result: ColumnCornerWorldPoint[] = [];
  for (const { anchor, point } of all) {
    if (CORNER_LABELS.has(anchor as ColumnCornerLabel)) {
      result.push({ corner: anchor as ColumnCornerLabel, point });
    }
  }
  return result;
}
