/**
 * AMBIENT ALIGNMENT SOURCE — ADR-357 extension (Revit-style auto-tracking)
 *
 * Pure producer of transient alignment anchors for the Object Snap Tracking
 * resolver. Where the AutoCAD model requires the user to hover-acquire a point
 * for 1s (`TrackingPointStore`), this module emits anchors AUTOMATICALLY from
 * the columns near the cursor — the Revit "ambient alignment" behavior.
 *
 * It returns the SAME `AcquiredTrackingPoint[]` shape the resolver already
 * consumes, so the caller simply MERGES `[...TrackingPointStore.getPoints(),
 * ...collectAmbientAlignmentAnchors(...)]` before `resolveTrackingSnap`. One
 * engine, two sources — no duplicate subsystem (full SSoT).
 *
 * Transient: `acquiredAt: 0` and these anchors NEVER enter the FIFO/decay store
 * — they are recomputed each hover frame as the cursor moves.
 *
 * Pure — zero React/DOM/store. Reuses existing geometry SSoT only:
 *   • `getBimCharacteristicPoints` — column corner(4)+midpoint(4)+center(1) world points.
 *   • `footprintBounds` / `distanceToFootprintBounds` — cursor-to-column proximity.
 *
 * @see ./tracking-resolver.ts — the shared resolver these anchors feed.
 * @see ../../bim/utils/bim-characteristic-points.ts — char-points SSoT.
 * @see ../../bim/geometry/shared/footprint-face-frame.ts — bounds/distance SSoT.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isColumnEntity } from '../../types/entities';
import type { AcquiredTrackingPoint } from './TrackingPointStore';
import { getBimCharacteristicPoints } from '../../bim/utils/bim-characteristic-points';
import {
  footprintBounds,
  distanceToFootprintBounds,
} from '../../bim/geometry/shared/footprint-face-frame';

/** `sourceSnapType` tag identifying anchors produced by the ambient source. */
export const AMBIENT_SOURCE_TYPE = 'ambient-column';

export interface AmbientAlignmentConfig {
  /** Cursor-proximity radius (world units). Columns farther than this are ignored. */
  readonly radiusWorld: number;
  /** Keep only the N nearest columns within radius (perf cap). */
  readonly maxColumns: number;
  /**
   * Axis gate (world units): a column point is emitted only when the cursor is
   * within this distance of its row OR column — i.e. only when it can actually
   * produce a useful H/V alignment path. Drops >90% of irrelevant anchors.
   */
  readonly axisToleranceWorld: number;
}

interface ColumnProximity {
  /** The 9 characteristic world points (corners + midpoints + center). */
  readonly points: readonly Point2D[];
  /** Cursor distance to the column footprint bbox (0 when inside). */
  readonly distance: number;
}

/**
 * Pure: nearest-N columns within radius → their characteristic points → only
 * the points axis-aligned with the cursor → transient `AcquiredTrackingPoint[]`.
 */
export function collectAmbientAlignmentAnchors(
  cursor: Point2D,
  entities: readonly Entity[],
  cfg: AmbientAlignmentConfig,
): AcquiredTrackingPoint[] {
  const near = nearestColumnsWithinRadius(cursor, entities, cfg);
  const anchors: AcquiredTrackingPoint[] = [];
  for (const col of near) {
    pushAxisGatedAnchors(cursor, col.points, cfg.axisToleranceWorld, anchors);
  }
  return anchors;
}

/** Single linear scan: columns whose footprint bbox is within `radiusWorld`, nearest-N. */
function nearestColumnsWithinRadius(
  cursor: Point2D,
  entities: readonly Entity[],
  cfg: AmbientAlignmentConfig,
): ColumnProximity[] {
  const out: ColumnProximity[] = [];
  for (const e of entities) {
    if (!isColumnEntity(e)) continue;
    const cp = getBimCharacteristicPoints(e);
    const bounds = footprintBounds(cp.corners);
    if (!bounds) continue;
    const distance = distanceToFootprintBounds(cursor, bounds);
    if (distance > cfg.radiusWorld) continue;
    const points = [...cp.corners, ...cp.midpoints, ...(cp.center ? [cp.center] : [])];
    out.push({ points, distance });
  }
  out.sort((a, b) => a.distance - b.distance);
  return out.length > cfg.maxColumns ? out.slice(0, cfg.maxColumns) : out;
}

/** Emit each point sharing the cursor's row OR column as a transient ambient anchor. */
function pushAxisGatedAnchors(
  cursor: Point2D,
  points: readonly Point2D[],
  axisTol: number,
  out: AcquiredTrackingPoint[],
): void {
  for (const p of points) {
    const alignsVertical = Math.abs(cursor.x - p.x) < axisTol;
    const alignsHorizontal = Math.abs(cursor.y - p.y) < axisTol;
    if (alignsVertical || alignsHorizontal) {
      out.push({ x: p.x, y: p.y, acquiredAt: 0, sourceSnapType: AMBIENT_SOURCE_TYPE });
    }
  }
}
