/**
 * ADR-410 — furniture parametric 2D grips.
 *
 * Thin adapter over the shared **centred rotatable-box** grip SSoT
 * (`bim/grips/centred-box-grips.ts`). Furniture is **rectangular-only** (no
 * circular/diameter affordance — simpler than the MEP fixture), so this module
 * delegates 100% to the box SSoT and only:
 *   - maps the entity-agnostic grip ROLES (`'move'` / `'rotation'` / `'corner-*'`)
 *     to/from the furniture grip-kind strings (`'furniture-move'`, …);
 *   - maps the furniture field names (`rotationDeg` / `widthMm` / `depthMm`) onto
 *     the box SSoT's (`rotation` / `width` / `length`) and back on commit.
 *
 * Rectangular (6 grips): 0 → move, 1 → rotation, 2-5 → corners (ne, nw, sw, se).
 *
 * SSoT: all box geometry + rotation math live in the shared box SSoT + `grip-math`
 * (ADR-188 canonical `rotatePoint`) — NO re-implemented cos/sin here.
 * `UpdateFurnitureParamsCommand` recomputes geometry at commit time; this module
 * returns ONLY new `FurnitureParams`.
 *
 * @see bim/grips/centred-box-grips.ts — the shared box SSoT (consumed by fixture + panel too)
 * @see docs/centralized-systems/reference/adrs/ADR-410-cc0-mesh-furniture-import.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, FurnitureGripKind } from '../../hooks/grip-types';
import type { FurnitureEntity, FurnitureParams } from '../types/furniture-types';
import { MIN_FURNITURE_DIMENSION_MM } from '../types/furniture-types';
import {
  getCentredBoxGrips,
  applyCentredBoxGripDrag,
  type CentredBoxGripRole,
  type CentredBoxParams,
} from '../grips/centred-box-grips';

// ─── Role ↔ furniture-kind maps ───────────────────────────────────────────────

const ROLE_TO_KIND: Readonly<Record<CentredBoxGripRole, FurnitureGripKind>> = {
  'move': 'furniture-move',
  'rotation': 'furniture-rotation',
  'corner-ne': 'furniture-corner-ne',
  'corner-nw': 'furniture-corner-nw',
  'corner-sw': 'furniture-corner-sw',
  'corner-se': 'furniture-corner-se',
};
const KIND_TO_ROLE: Readonly<Partial<Record<FurnitureGripKind, CentredBoxGripRole>>> = {
  'furniture-move': 'move',
  'furniture-rotation': 'rotation',
  'furniture-corner-ne': 'corner-ne',
  'furniture-corner-nw': 'corner-nw',
  'furniture-corner-sw': 'corner-sw',
  'furniture-corner-se': 'corner-se',
};

// ─── Field mapping (furniture ↔ centred box) ──────────────────────────────────

/**
 * Project `FurnitureParams` onto the box SSoT's view. The field names differ
 * (`rotationDeg`/`widthMm`/`depthMm` → `rotation`/`width`/`length`), so unlike
 * the MEP fixture this needs an explicit mapping (not structurally assignable).
 */
function toBoxParams(params: FurnitureParams): CentredBoxParams {
  return {
    position: { x: params.position.x, y: params.position.y, z: params.position.z },
    rotation: params.rotationDeg,
    width: params.widthMm,
    length: params.depthMm,
    sceneUnits: params.sceneUnits,
  };
}

// ─── Grip emission ───────────────────────────────────────────────────────────

/**
 * Compute parametric grip positions for a `FurnitureEntity`. Stable order:
 * 0 → move, 1 → rotation, 2-5 → corners (ne, nw, sw, se). Delegates 100% to the
 * shared box SSoT, mapping roles → furniture kinds.
 */
export function getFurnitureGrips(entity: Readonly<FurnitureEntity>): GripInfo[] {
  return getCentredBoxGrips(toBoxParams(entity.params)).map((g) => ({
    entityId: entity.id,
    gripIndex: g.gripIndex,
    type: g.type,
    position: g.position,
    movesEntity: g.movesEntity,
    furnitureGripKind: ROLE_TO_KIND[g.role],
  }));
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

export interface FurnitureGripDragInput {
  /** Original params at drag start (preserves invariants). */
  readonly originalParams: FurnitureParams;
  /** World-space delta from the grip anchor to the current cursor position. */
  readonly delta: Point2D;
  /** ORTHO (F8) active → corner resize constrained to the dominant local axis. */
  readonly ortho?: boolean;
  /**
   * Rotation centre for the `furniture-rotation` 6-click hot-grip
   * (AutoCAD ROTATE→Reference). With `currentPos`, the furniture orbits this centre.
   */
  readonly pivot?: Point2D;
  /** World cursor position (= grip anchor + `delta`). Pivot-rotate path only. */
  readonly currentPos?: Point2D;
}

/**
 * Pure transform: furniture grip kind + drag input → new `FurnitureParams`.
 * Delegates to the shared box SSoT and maps the box patch fields back onto the
 * furniture field names. Zero delta / unknown kind → returns `originalParams`
 * referentially unchanged (commit short-circuit).
 */
export function applyFurnitureGripDrag(
  kind: FurnitureGripKind,
  input: Readonly<FurnitureGripDragInput>,
): FurnitureParams {
  const { originalParams } = input;
  if (input.delta.x === 0 && input.delta.y === 0) return originalParams;

  const role = KIND_TO_ROLE[kind];
  if (!role) return originalParams;

  const patch = applyCentredBoxGripDrag(role, {
    originalParams: toBoxParams(originalParams),
    delta: input.delta,
    minDimensionMm: MIN_FURNITURE_DIMENSION_MM,
    ortho: input.ortho,
    ...(input.pivot ? { pivot: input.pivot } : {}),
    ...(input.currentPos ? { currentPos: input.currentPos } : {}),
  });
  if (!patch) return originalParams;

  return {
    ...originalParams,
    position: { x: patch.position.x, y: patch.position.y, z: patch.position.z },
    rotationDeg: patch.rotation,
    widthMm: patch.width,
    depthMm: patch.length,
  };
}
