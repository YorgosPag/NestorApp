/**
 * ADR-408 Εύρος Β #1 — Heating radiator parametric 2D grips (wall-parity).
 *
 * Thin adapter over the shared **centred rotatable-box** grip SSoT
 * (`bim/grips/centred-box-grips.ts`). A radiator is **always rectangular** (no
 * circular / diameter handle), so it delegates 100% to the SSoT and only maps the
 * entity-agnostic grip ROLES (`'move'` / `'rotation'` / `'corner-*'`) to/from the
 * radiator-specific grip-kind strings (`'mep-radiator-move'`, …) that the
 * discriminator unions + glyph / hot-grip / commit registries expect. 1:1 mirror
 * of `mep-manifold-grips.ts`.
 *
 * @see bim/grips/centred-box-grips.ts — the shared box SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, MepRadiatorGripKind } from '../../hooks/grip-types';
import type { MepRadiatorEntity, MepRadiatorParams } from '../types/mep-radiator-types';
import { MIN_RADIATOR_DIMENSION_MM } from '../types/mep-radiator-types';
import {
  getCentredBoxGrips,
  applyCentredBoxGripDrag,
  type CentredBoxGripRole,
} from '../grips/centred-box-grips';

// ─── Role ↔ radiator-kind maps ────────────────────────────────────────────────

const ROLE_TO_KIND: Readonly<Record<CentredBoxGripRole, MepRadiatorGripKind>> = {
  'move': 'mep-radiator-move',
  'rotation': 'mep-radiator-rotation',
  'corner-ne': 'mep-radiator-corner-ne',
  'corner-nw': 'mep-radiator-corner-nw',
  'corner-sw': 'mep-radiator-corner-sw',
  'corner-se': 'mep-radiator-corner-se',
};
const KIND_TO_ROLE: Readonly<Record<MepRadiatorGripKind, CentredBoxGripRole>> = {
  'mep-radiator-move': 'move',
  'mep-radiator-rotation': 'rotation',
  'mep-radiator-corner-ne': 'corner-ne',
  'mep-radiator-corner-nw': 'corner-nw',
  'mep-radiator-corner-sw': 'corner-sw',
  'mep-radiator-corner-se': 'corner-se',
};

// ─── Grip emission ───────────────────────────────────────────────────────────

/**
 * Compute parametric grip positions for a `MepRadiatorEntity` (6 grips, stable
 * order: move, rotation, 4 corners). Delegates to the shared box SSoT.
 */
export function getMepRadiatorGrips(entity: Readonly<MepRadiatorEntity>): GripInfo[] {
  return getCentredBoxGrips(entity.params).map((g) => ({
    entityId: entity.id,
    gripIndex: g.gripIndex,
    type: g.type,
    position: g.position,
    movesEntity: g.movesEntity,
    mepRadiatorGripKind: ROLE_TO_KIND[g.role],
  }));
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

export interface MepRadiatorGripDragInput {
  /** Original params at drag start (preserves invariants). */
  readonly originalParams: MepRadiatorParams;
  /** World-space delta from the grip anchor to the current cursor position. */
  readonly delta: Point2D;
  /** ORTHO (F8) active → corner resize constrained to the dominant local axis. */
  readonly ortho?: boolean;
  /** Rotation centre for the 6-click hot-grip (AutoCAD ROTATE→Reference). */
  readonly pivot?: Point2D;
  /** World cursor position (= grip anchor + `delta`). Pivot-rotate path only. */
  readonly currentPos?: Point2D;
}

/**
 * Pure transform: radiator grip kind + drag input → new `MepRadiatorParams`.
 * Delegates to the shared box SSoT; zero delta / unknown kind → returns
 * `originalParams` referentially unchanged (commit short-circuit).
 */
export function applyMepRadiatorGripDrag(
  kind: MepRadiatorGripKind,
  input: Readonly<MepRadiatorGripDragInput>,
): MepRadiatorParams {
  const { originalParams } = input;
  const role = KIND_TO_ROLE[kind];
  if (!role) return originalParams;
  const patch = applyCentredBoxGripDrag(role, {
    originalParams,
    delta: input.delta,
    minDimensionMm: MIN_RADIATOR_DIMENSION_MM,
    ortho: input.ortho,
    ...(input.pivot ? { pivot: input.pivot } : {}),
    ...(input.currentPos ? { currentPos: input.currentPos } : {}),
  });
  if (!patch) return originalParams;
  return { ...originalParams, ...patch };
}
