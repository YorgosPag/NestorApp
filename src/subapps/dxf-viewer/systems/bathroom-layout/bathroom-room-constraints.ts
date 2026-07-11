/**
 * Bathroom room constraints — door swing quadrants + wall plaster inset · ADR-638 (Στάδιο 3).
 *
 * Two real-world constraints the auto-arrange must honour, both derived from the
 * BIM model (never re-invented):
 *
 *   1. **Door swing quadrant** — a hinged door sweeps a quarter-disc the fixtures
 *      must stay out of. The opening geometry ALREADY carries the exact swing arc
 *      (`OpeningGeometry.hingeArc` + `hingeAnchor`, ADR-363), so we build the swing
 *      SECTOR polygon `[hingeAnchor, …arc]` — a convex quarter-disc — straight from
 *      it (double-leaf → two sectors). No more toward-centroid rectangle guess.
 *
 *   2. **Wall plaster (σοβάς) thickness** — the picked room polygon traces the
 *      STRUCTURAL wall faces (wall-aware region detection, Στάδιο 2b.1). The finished
 *      (plastered) face sits `finish.thickness` inward, so fixtures must hug that,
 *      not the bare structural face. We inset the room polygon by the resolved
 *      interior finish thickness (reusing `insetPolygonMiter`, concave-safe).
 *
 * Pure functions of the level entities + polygon — unit-testable with stub entities.
 * Millimetres throughout (ADR-462): positions scaled scene→mm at extraction.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-638-bathroom-auto-layout-generator.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import type { Entity } from '../../types/entities';
import { isOpeningEntity, isWallEntity } from '../../types/entities';
import { isFinishActive } from '../../bim/finishes/structural-finish-types';
import { insetPolygonMiter } from '../../bim/geometry/shared/polygon-offset-utils';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import type { DoorMarker } from './recognized-space-adapter';

/** The door `OpeningKind`s (windows never block fixture placement). */
export const DOOR_KINDS: ReadonlySet<string> = new Set([
  'door', 'double-door', 'sliding-door', 'double-sliding-door', 'pocket-door',
  'bifold-door', 'overhead-door', 'revolving-door', 'french-door',
]);

/** Doors that sweep a hinge arc — a swing quadrant the fixtures must avoid. */
const HINGED_DOOR_KINDS: ReadonlySet<string> = new Set([
  'door', 'double-door', 'french-door',
]);

/** Result of reading the level's doors: accurate swing sectors + non-hinged fallbacks. */
export interface DoorConstraints {
  /** Convex swing-quadrant polygons (mm) — one per hinged leaf. */
  readonly swingZonesMm: Point2D[][];
  /** Non-hinged doors (sliding/pocket/…) as position+width markers for a rect fallback. */
  readonly fallbackDoors: DoorMarker[];
}

/** Scale a scene-space point to millimetres. */
function toMmPoint(p: Point3D, toMm: number): Point2D {
  return { x: p.x * toMm, y: p.y * toMm };
}

/**
 * Read every door opening and split it into an accurate swing SECTOR (hinged) or a
 * position+width fallback marker (non-hinged). A hinged door's `hingeArc.points` run
 * along the swept quarter-disc; prefixed with the `hingeAnchor` apex they form a
 * convex sector polygon. A double-leaf door carries both arcs concatenated in
 * `points` (+ `hingeAnchor2`), so we split the point list in half — one convex
 * sector per leaf.
 */
export function extractDoorConstraints(
  entities: readonly Entity[],
  sceneUnits: SceneUnits,
): DoorConstraints {
  const toMm = 1 / mmToSceneUnits(sceneUnits);
  const swingZonesMm: Point2D[][] = [];
  const fallbackDoors: DoorMarker[] = [];
  for (const e of entities) {
    if (!isOpeningEntity(e)) continue;
    if (!DOOR_KINDS.has(e.params.kind)) continue;
    const g = e.geometry;
    const arcPts = g?.hingeArc?.points;
    if (HINGED_DOOR_KINDS.has(e.params.kind) && g?.hingeAnchor && arcPts && arcPts.length >= 2) {
      const anchor = toMmPoint(g.hingeAnchor, toMm);
      if (g.hingeAnchor2) {
        // Double-leaf: points = [arc1 … , arc2 …]; one convex sector per leaf.
        const mid = Math.floor(arcPts.length / 2);
        const anchor2 = toMmPoint(g.hingeAnchor2, toMm);
        swingZonesMm.push([anchor, ...arcPts.slice(0, mid).map((p) => toMmPoint(p, toMm))]);
        swingZonesMm.push([anchor2, ...arcPts.slice(mid).map((p) => toMmPoint(p, toMm))]);
      } else {
        swingZonesMm.push([anchor, ...arcPts.map((p) => toMmPoint(p, toMm))]);
      }
      continue;
    }
    // Non-hinged door (sliding / pocket / overhead / revolving) — no swing arc; keep the
    // legacy position+width so the adapter can still reserve an entry keep-clear.
    const pos = g?.position;
    if (pos) fallbackDoors.push({ positionMm: toMmPoint(pos, toMm), widthMm: e.params.width });
  }
  return { swingZonesMm, fallbackDoors };
}

/**
 * Resolve the representative INTERIOR plaster (σοβάς) thickness (mm) to inset the room
 * by, from the level's BIM walls. Uses the ADR-449 `finish` skin spec (`isFinishActive`
 * SSoT) and takes the MAX active interior thickness — conservative so a fixture never
 * overlaps the plaster on the thickest-finished wall. `0` when no wall carries an active
 * finish (bare structural / imported-DXF room → nothing to inset).
 */
export function resolveInteriorFinishThicknessMm(entities: readonly Entity[]): number {
  let maxMm = 0;
  for (const e of entities) {
    if (!isWallEntity(e)) continue;
    const finish = e.params.finish;
    if (isFinishActive(finish)) maxMm = Math.max(maxMm, finish.thickness);
  }
  return maxMm;
}

/**
 * Inset the room polygon inward by the plaster thickness so fixtures hug the FINISHED
 * face. `thicknessMm ≤ 0` (no active finish) → the polygon unchanged. Reuses the
 * concave-safe `insetPolygonMiter` (Γ/Π/L rooms handled); if the inset collapses the
 * ring (tiny room) it falls back to the original polygon rather than emptying it.
 */
export function insetRoomForPlasterMm(
  polygonMm: readonly Point2D[],
  thicknessMm: number,
): Point2D[] {
  if (thicknessMm <= 0) return [...polygonMm];
  const inset = insetPolygonMiter(polygonMm, thicknessMm);
  return inset && inset.length >= 3 ? inset : [...polygonMm];
}
