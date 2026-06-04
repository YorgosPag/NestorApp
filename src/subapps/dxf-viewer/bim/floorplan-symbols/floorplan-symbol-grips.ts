/**
 * ADR-415 — floorplan-symbol parametric 2D grips.
 *
 * Thin adapter over the shared **centred rotatable-box** grip SSoT
 * (`bim/grips/centred-box-grips.ts`) — the SAME engine furniture / MEP fixture /
 * electrical panel use. A floorplan symbol is a centre-anchored rotatable
 * rectangle, so this module delegates 100% to the box SSoT and only:
 *   - maps the entity-agnostic grip ROLES (`'move'` / `'rotation'` / `'corner-*'`)
 *     to/from the floorplan-symbol grip-kind strings (`'floorplan-symbol-move'`, …);
 *   - maps the field names (`rotationDeg` / `widthMm` / `depthMm`) onto the box
 *     SSoT's (`rotation` / `width` / `length`) and back on commit.
 *
 * Rectangular (6 grips): 0 → move, 1 → rotation, 2-5 → corners (ne, nw, sw, se).
 * NO re-implemented cos/sin — all rotation math lives in the box SSoT + grip-math.
 *
 * @see bim/grips/centred-box-grips.ts — the shared box SSoT
 * @see bim/furniture/furniture-grips.ts — the 1:1 sibling adapter
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, FloorplanSymbolGripKind } from '../../hooks/grip-types';
import type { FloorplanSymbolEntity, FloorplanSymbolParams } from '../types/floorplan-symbol-types';
import { MIN_FLOORPLAN_SYMBOL_DIMENSION_MM } from '../types/floorplan-symbol-types';
import {
  getCentredBoxGrips,
  applyCentredBoxGripDrag,
  type CentredBoxGripRole,
  type CentredBoxParams,
} from '../grips/centred-box-grips';

// ─── Role ↔ floorplan-symbol-kind maps ────────────────────────────────────────

const ROLE_TO_KIND: Readonly<Record<CentredBoxGripRole, FloorplanSymbolGripKind>> = {
  'move': 'floorplan-symbol-move',
  'rotation': 'floorplan-symbol-rotation',
  'corner-ne': 'floorplan-symbol-corner-ne',
  'corner-nw': 'floorplan-symbol-corner-nw',
  'corner-sw': 'floorplan-symbol-corner-sw',
  'corner-se': 'floorplan-symbol-corner-se',
};
const KIND_TO_ROLE: Readonly<Partial<Record<FloorplanSymbolGripKind, CentredBoxGripRole>>> = {
  'floorplan-symbol-move': 'move',
  'floorplan-symbol-rotation': 'rotation',
  'floorplan-symbol-corner-ne': 'corner-ne',
  'floorplan-symbol-corner-nw': 'corner-nw',
  'floorplan-symbol-corner-sw': 'corner-sw',
  'floorplan-symbol-corner-se': 'corner-se',
};

// ─── Field mapping (floorplan symbol ↔ centred box) ──────────────────────────

function toBoxParams(params: FloorplanSymbolParams): CentredBoxParams {
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
 * Compute parametric grip positions for a `FloorplanSymbolEntity`. Stable order:
 * 0 → move, 1 → rotation, 2-5 → corners (ne, nw, sw, se). Delegates 100% to the
 * shared box SSoT, mapping roles → floorplan-symbol kinds.
 */
export function getFloorplanSymbolGrips(entity: Readonly<FloorplanSymbolEntity>): GripInfo[] {
  return getCentredBoxGrips(toBoxParams(entity.params)).map((g) => ({
    entityId: entity.id,
    gripIndex: g.gripIndex,
    type: g.type,
    position: g.position,
    movesEntity: g.movesEntity,
    floorplanSymbolGripKind: ROLE_TO_KIND[g.role],
  }));
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

export interface FloorplanSymbolGripDragInput {
  readonly originalParams: FloorplanSymbolParams;
  readonly delta: Point2D;
  readonly ortho?: boolean;
  readonly pivot?: Point2D;
  readonly currentPos?: Point2D;
}

/**
 * Pure transform: floorplan-symbol grip kind + drag input → new params. Delegates
 * to the shared box SSoT and maps the box patch fields back onto the symbol field
 * names. Zero delta / unknown kind → returns `originalParams` referentially
 * unchanged (commit short-circuit).
 */
export function applyFloorplanSymbolGripDrag(
  kind: FloorplanSymbolGripKind,
  input: Readonly<FloorplanSymbolGripDragInput>,
): FloorplanSymbolParams {
  const { originalParams } = input;
  if (input.delta.x === 0 && input.delta.y === 0) return originalParams;

  const role = KIND_TO_ROLE[kind];
  if (!role) return originalParams;

  const patch = applyCentredBoxGripDrag(role, {
    originalParams: toBoxParams(originalParams),
    delta: input.delta,
    minDimensionMm: MIN_FLOORPLAN_SYMBOL_DIMENSION_MM,
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
