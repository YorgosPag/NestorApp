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
 *   • Text / MText (Giorgio 2026-07-07, ADR-557): the insertion point (origin), so
 *     a nearby label lights the same cyan H/V traces — full column-move parity.
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
  type FootprintBounds,
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
  // ADR-557 — the entity/-ies currently being MOVED. You never OTRACK to the object you are
  // dragging (Revit/AutoCAD; mirrors the OSNAP `excludeEntityId` in corner-projection-snap). Its
  // own insertion point would otherwise be a phantom anchor: harmless for a line / short single-line
  // text (its origin ≈ the grabbed base point, so it dedups with the ref anchor), but for a MULTI-LINE
  // text the origin sits far below the box-centre anchor → it becomes a distinct anchor that the
  // resolver locks onto, drowning out the real neighbour traces (Giorgio browser-verify 2026-07-07).
  excludeIds?: ReadonlySet<string> | null,
): AcquiredTrackingPoint[] {
  const near = nearestMembersWithinRadius(cursor, entities, cfg, excludeIds);
  const anchors: AcquiredTrackingPoint[] = [];
  for (const m of near) {
    pushAxisGatedAnchors(cursor, m.points, cfg.axisToleranceWorld, anchors);
  }
  return anchors;
}

/**
 * Axis-aligned bbox straight from a point list — the degenerate fallback for a
 * member with < 3 characteristic points (`footprintBounds` needs a polygon ≥ 3
 * verts). A single text insertion point yields a zero-size bbox AT the point, so
 * `distanceToFootprintBounds` still measures cursor-to-point proximity correctly.
 */
function boundsFromPoints(pts: readonly Point2D[]): FootprintBounds | null {
  if (pts.length === 0) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY };
}

/** Single linear scan: members whose footprint bbox is within radius, nearest-N. */
function nearestMembersWithinRadius(
  cursor: Point2D,
  entities: readonly Entity[],
  cfg: AmbientAlignmentConfig,
  excludeIds?: ReadonlySet<string> | null,
): MemberProximity[] {
  const out: MemberProximity[] = [];
  for (const e of entities) {
    // ADR-557 — skip the entity/-ies being dragged (no self-tracking); see `collectAmbientAlignmentAnchors`.
    if (excludeIds?.has(e.id)) continue;
    const points = ambientPointsForEntity(e);
    if (points.length === 0) continue;
    // ADR-557 — a text contributes a single insertion point (< 3 verts), so fall
    // back to the point-list bbox when the polygon SSoT returns null.
    const bounds = footprintBounds(points) ?? boundsFromPoints(points);
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
  // ADR-557 — Text / MText participate as alignment SOURCES via their insertion
  // point (origin), so a nearby label lights the SAME cyan H/V traces a line does
  // when ANY entity is moved/rotated near it (Giorgio 2026-07-07: «κυανές ενδείξεις
  // κειμένων»). Kept to the O(1) top-level `position` — NOT the glyph-ink box —
  // because `ambientPointsForEntity` runs for EVERY scene entity each drag frame
  // (ADR-040 perf); box corners would force per-frame font metrics over all texts.
  if (e.type === 'text' || e.type === 'mtext') {
    const p = (e as { position?: Point2D }).position;
    return p ? [{ x: p.x, y: p.y }] : [];
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
