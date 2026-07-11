/**
 * RecognizedSpace → RoomInput adapter · ADR-638 (Στάδιο 2).
 *
 * Bridges the recognition layer (ADR-425 `RecognizedSpace`, SCENE units) to the
 * solver's {@link RoomInput} (millimetres): converts the room polygon scene→mm and
 * turns door markers into a keep-clear polygon the solver routes fixtures around.
 * Pure & unit-testable — the messy entity access (opening → door marker) lives in
 * the thin ribbon layer that calls this. Reuses `polygon2DCentroid` (no new math).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-638-bathroom-auto-layout-generator.md
 */

import type { Point2D } from '../../rendering/types/Types';
import { polygon2DCentroid } from '../../bim/geometry/shared/polygon-utils';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import type { LayoutFixtureKind, RoomInput } from './bathroom-layout-types';

/** A door reduced to what the layout needs: where it is + how wide (both mm). */
export interface DoorMarker {
  /** Door centre in millimetres (room frame). */
  readonly positionMm: Point2D;
  /** Door leaf width in millimetres. */
  readonly widthMm: number;
}

/** Scene-units → millimetres scale (`valueScene × sceneToMm = valueMm`). */
function sceneToMm(units: SceneUnits): number {
  return 1 / mmToSceneUnits(units);
}

/** Convert a scene-units polygon to millimetres. */
export function spacePolygonToMm(
  polygon: readonly Point2D[],
  units: SceneUnits,
): Point2D[] {
  const s = sceneToMm(units);
  return polygon.map((p) => ({ x: p.x * s, y: p.y * s }));
}

/**
 * Keep-clear rectangle spanning a door and extending `clearanceMm` toward the room
 * centroid (so the solver keeps fixtures out of the door swing / entry path). All
 * millimetres; CCW-ish (solver only needs its area + centroid).
 */
export function buildDoorKeepClear(
  door: DoorMarker,
  roomCentroidMm: Point2D,
  clearanceMm = 750,
): Point2D[] {
  const dx = roomCentroidMm.x - door.positionMm.x;
  const dy = roomCentroidMm.y - door.positionMm.y;
  const len = Math.hypot(dx, dy) || 1;
  const inx = dx / len;
  const iny = dy / len; // unit vector from door toward room interior
  const ax = -iny;
  const ay = inx; // unit vector along the doorway
  const half = door.widthMm / 2 + 100;
  const b0 = { x: door.positionMm.x - ax * half, y: door.positionMm.y - ay * half };
  const b1 = { x: door.positionMm.x + ax * half, y: door.positionMm.y + ay * half };
  const f1 = { x: b1.x + inx * clearanceMm, y: b1.y + iny * clearanceMm };
  const f0 = { x: b0.x + inx * clearanceMm, y: b0.y + iny * clearanceMm };
  return [b0, b1, f1, f0];
}

/** Options for {@link recognizedSpaceToRoomInput}. */
export interface SpaceToRoomInputOptions {
  /** Doors in the room (mm) — the widest becomes the primary keep-clear. */
  readonly doorsMm?: readonly DoorMarker[];
  /** Door clearance depth (mm, default 750). */
  readonly clearanceMm?: number;
  /** Index of a wall carrying a plumbing stack (wet fixtures score higher there). */
  readonly wetWallHintIndex?: number;
}

/**
 * Convert a recognised bathroom space (scene units) + requested fixtures into a
 * solver {@link RoomInput} (mm), deriving the primary door's keep-clear zone.
 */
export function recognizedSpaceToRoomInput(
  spacePolygonScene: readonly Point2D[],
  units: SceneUnits,
  fixtures: readonly LayoutFixtureKind[],
  options: SpaceToRoomInputOptions = {},
): RoomInput {
  const polygonMm = spacePolygonToMm(spacePolygonScene, units);
  const centroid = polygon2DCentroid(polygonMm);
  const doors = options.doorsMm ?? [];
  const primary = doors.reduce<DoorMarker | null>(
    (best, d) => (best === null || d.widthMm > best.widthMm ? d : best),
    null,
  );
  const doorKeepClearMm = primary
    ? buildDoorKeepClear(primary, centroid, options.clearanceMm)
    : undefined;
  return {
    polygonMm,
    fixtures,
    ...(doorKeepClearMm ? { doorKeepClearMm } : {}),
    ...(options.wetWallHintIndex !== undefined ? { wetWallHintIndex: options.wetWallHintIndex } : {}),
  };
}
