/**
 * AMBIENT ALIGNMENT SOURCE — ADR-357 extension (Revit-style auto-tracking)
 *
 * Pure producer of transient alignment anchors for the Object Snap Tracking
 * resolver. Where the AutoCAD model requires the user to hover-acquire a point
 * for 1s (`TrackingPointStore`), this module emits anchors AUTOMATICALLY from
 * the members near the cursor — the Revit "ambient alignment" behavior.
 * Members covered:
 *   • BIM (Giorgio 2026-06-21): column, wall, beam, slab, foundation.
 *   • Plain CAD geometry (Giorgio 2026-07-04): line, polyline, lwpolyline,
 *     rectangle, arc — endpoints + midpoints, so a drawn line's corner emits a
 *     vertical/horizontal trace WITHOUT the AutoCAD hover-acquire (OTRACK) step.
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
 *   • `getBimCharacteristicPoints` — generic BIM dispatcher: corner+midpoint+center
 *     world points for column/wall/beam/slab/foundation (zero new geometry).
 *   • `footprintBounds` / `distanceToFootprintBounds` — cursor-to-member proximity.
 *
 * @see ./tracking-resolver.ts — the shared resolver these anchors feed.
 * @see ../../bim/utils/bim-characteristic-points.ts — char-points SSoT.
 * @see ../../bim/geometry/shared/footprint-face-frame.ts — bounds/distance SSoT.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { AcquiredTrackingPoint } from './TrackingPointStore';
import { getBimCharacteristicPoints } from '../../bim/utils/bim-characteristic-points';
import {
  footprintBounds,
  distanceToFootprintBounds,
} from '../../bim/geometry/shared/footprint-face-frame';
// ADR-357 (2026-07-04) — plain-geometry endpoints/midpoints reuse the OSNAP
// geometry SSoT (the SAME extractor the Endpoint/Midpoint snap engines consume),
// so a drawn line participates in alignment with zero duplicate geometry.
import { GeometricCalculations } from '../../snapping/shared/GeometricCalculations';

/** `sourceSnapType` tag identifying anchors produced by the ambient source. */
export const AMBIENT_SOURCE_TYPE = 'ambient-member';

/** Structural member entity types the ambient source aligns to. */
const STRUCTURAL_MEMBER_TYPES: ReadonlySet<string> = new Set([
  'column', 'wall', 'beam', 'slab', 'foundation',
]);

/**
 * Plain CAD geometry whose endpoints + midpoints also feed alignment (Revit-style,
 * Giorgio 2026-07-04). Their characteristic points come from the OSNAP geometry
 * SSoT (`GeometricCalculations`) — the SAME extractor the snap engines use.
 */
const PLAIN_GEOMETRY_TYPES: ReadonlySet<string> = new Set([
  'line', 'polyline', 'lwpolyline', 'rectangle', 'arc',
]);

export interface AmbientAlignmentConfig {
  /** Cursor-proximity radius (world units). Members farther than this are ignored. */
  readonly radiusWorld: number;
  /** Keep only the N nearest members within radius (perf cap). */
  readonly maxMembers: number;
  /**
   * Axis gate (world units): a member point is emitted only when the cursor is
   * within this distance of its row OR column — i.e. only when it can actually
   * produce a useful H/V alignment path. Drops >90% of irrelevant anchors.
   */
  readonly axisToleranceWorld: number;
}

interface MemberProximity {
  /** The characteristic world points (corners/endpoints + midpoints + center). */
  readonly points: readonly Point2D[];
  /** Cursor distance to the member footprint bbox (0 when inside). */
  readonly distance: number;
}

/**
 * Pure: nearest-N structural members within radius → their characteristic
 * points → only the points axis-aligned with the cursor → transient
 * `AcquiredTrackingPoint[]`.
 */
export function collectAmbientAlignmentAnchors(
  cursor: Point2D,
  entities: readonly Entity[],
  cfg: AmbientAlignmentConfig,
): AcquiredTrackingPoint[] {
  const near = nearestMembersWithinRadius(cursor, entities, cfg);
  const anchors: AcquiredTrackingPoint[] = [];
  for (const m of near) {
    pushAxisGatedAnchors(cursor, m.points, cfg.axisToleranceWorld, anchors);
  }
  return anchors;
}

/** Single linear scan: members whose footprint bbox is within radius, nearest-N. */
function nearestMembersWithinRadius(
  cursor: Point2D,
  entities: readonly Entity[],
  cfg: AmbientAlignmentConfig,
): MemberProximity[] {
  const out: MemberProximity[] = [];
  for (const e of entities) {
    const points = ambientPointsForEntity(e);
    if (points.length === 0) continue;
    const bounds = footprintBounds(points);
    if (!bounds) continue;
    const distance = distanceToFootprintBounds(cursor, bounds);
    if (distance > cfg.radiusWorld) continue;
    out.push({ points, distance });
  }
  out.sort((a, b) => a.distance - b.distance);
  return out.length > cfg.maxMembers ? out.slice(0, cfg.maxMembers) : out;
}

/**
 * Characteristic world points feeding alignment for one entity, or [] when the
 * type does not participate. BIM members → the BIM char-point dispatcher; plain
 * CAD geometry → the OSNAP endpoint/midpoint SSoT. One place decides the source
 * per type — no duplicate geometry, no parallel engine.
 */
function ambientPointsForEntity(e: Entity): Point2D[] {
  if (STRUCTURAL_MEMBER_TYPES.has(e.type)) {
    const cp = getBimCharacteristicPoints(e);
    return [...cp.corners, ...cp.midpoints, ...(cp.center ? [cp.center] : [])];
  }
  if (PLAIN_GEOMETRY_TYPES.has(e.type)) {
    return [
      ...GeometricCalculations.getEntityEndpoints(e),
      ...GeometricCalculations.getEntityMidpoints(e),
    ];
  }
  return [];
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
