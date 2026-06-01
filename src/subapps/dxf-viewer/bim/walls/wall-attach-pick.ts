/**
 * WALL ATTACH PICK — ADR-401 Phase E.1 (manual attach pick-host helpers).
 *
 * Pure, React-free SSoT for the manual «Attach Top/Base to…» interaction
 * (`useWallAttachTool`):
 *   - `resolveWallAttachTargets` — selected entity ids → wall attach targets
 *     (`{ wallId, kind }`), skipping non-walls. Feeds `AttachWalls{Top|Base}Command`.
 *   - `resolveStructuralHostId` — validates the already-hovered entity id as a
 *     structural host (beam/slab). PRIMARY pick path: reuses the unit-correct
 *     `HoverStore` result (`getHoveredEntity()`), so NO unit math is needed.
 *   - `findStructuralHostAtPoint` — geometry fallback in **mm space** (slab →
 *     point-in-polygon over `outline`, beam → distance-to-axis < half-width).
 *     The caller converts the scene-unit click point to mm at the boundary
 *     (mirrors `useRibbonWallBridge` `mmToSceneUnits`), keeping this pure.
 *
 * @see core/commands/entity-commands/AttachWallsTopCommand.ts — WallAttachTarget
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §2.5
 */

import type { Entity } from '../../types/entities';
import { isWallEntity, isBeamEntity, isSlabEntity, isColumnEntity, isStairEntity } from '../../types/entities';
import type { WallAttachTarget } from '../../core/commands/entity-commands/AttachWallsTopCommand';
import type { ColumnAttachTarget } from '../../core/commands/entity-commands/AttachColumnsCommand';
import type { StairAttachTarget } from '../../core/commands/entity-commands/AttachStairsCommand';
import type { Point2D } from '../../rendering/types/Types';
import { pointInPolygon } from '../geometry/shared/polygon-utils';

/** Selected entity ids → wall attach targets (id + kind). Non-walls skipped. */
export function resolveWallAttachTargets(
  selectedIds: readonly string[],
  entities: readonly Entity[],
): WallAttachTarget[] {
  const targets: WallAttachTarget[] = [];
  for (const id of selectedIds) {
    const e = entities.find((x) => x.id === id);
    if (e && isWallEntity(e)) targets.push({ wallId: e.id, kind: e.kind });
  }
  return targets;
}

/** Selected entity ids → column attach targets (id + kind). Non-columns skipped. */
export function resolveColumnAttachTargets(
  selectedIds: readonly string[],
  entities: readonly Entity[],
): ColumnAttachTarget[] {
  const targets: ColumnAttachTarget[] = [];
  for (const id of selectedIds) {
    const e = entities.find((x) => x.id === id);
    if (e && isColumnEntity(e)) targets.push({ columnId: e.id, kind: e.kind });
  }
  return targets;
}

/** Selected entity ids → stair attach targets (id + kind). Non-stairs skipped. */
export function resolveStairAttachTargets(
  selectedIds: readonly string[],
  entities: readonly Entity[],
): StairAttachTarget[] {
  const targets: StairAttachTarget[] = [];
  for (const id of selectedIds) {
    const e = entities.find((x) => x.id === id);
    if (e && isStairEntity(e)) targets.push({ stairId: e.id, kind: e.kind });
  }
  return targets;
}

/**
 * Validate the hovered entity id as a structural host (beam/slab). Returns the
 * id when valid, else `null`. Unit-safe — relies on the hover pipeline result.
 */
export function resolveStructuralHostId(
  entities: readonly Entity[],
  hoveredId: string | null,
): string | null {
  if (!hoveredId) return null;
  const e = entities.find((x) => x.id === hoveredId);
  if (!e) return null;
  return isBeamEntity(e) || isSlabEntity(e) ? e.id : null;
}

/** Perpendicular distance from `p` to segment `a→b` (XY). */
function distPointToSegment(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Geometry fallback host pick in **mm space**. `pointMm` and `tolMm` are in mm
 * (the caller converts from scene units). Slab = point inside `outline`; beam =
 * within `width/2 + tol` of its axis. Returns the first match (slabs first).
 */
export function findStructuralHostAtPoint(
  entities: readonly Entity[],
  pointMm: Point2D,
  tolMm: number,
): string | null {
  for (const e of entities) {
    if (isSlabEntity(e) && pointInPolygon(pointMm, e.params.outline.vertices)) {
      return e.id;
    }
  }
  for (const e of entities) {
    if (!isBeamEntity(e)) continue;
    const half = e.params.width / 2 + tolMm;
    const d = distPointToSegment(pointMm, e.params.startPoint, e.params.endPoint);
    if (d <= half) return e.id;
  }
  return null;
}
