/**
 * ADR-408 Εύρος Β #2 — Heating boiler parametric 2D grips (wall-parity).
 *
 * Thin adapter over the shared **centred rotatable-box** grip SSoT
 * (`bim/grips/centred-box-grips.ts`). A boiler is **always rectangular** (no
 * circular / diameter handle), so it delegates 100% to the SSoT and only maps the
 * entity-agnostic grip ROLES (`'move'` / `'rotation'` / `'corner-*'`) to/from the
 * boiler-specific grip-kind strings (`'mep-boiler-move'`, …) that the
 * discriminator unions + glyph / hot-grip / commit registries expect. 1:1 mirror
 * of `mep-radiator-grips.ts`.
 *
 * @see bim/grips/centred-box-grips.ts — the shared box SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, MepBoilerGripKind } from '../../hooks/grip-types';
import type { MepBoilerEntity, MepBoilerParams } from '../types/mep-boiler-types';
import { MIN_BOILER_DIMENSION_MM } from '../types/mep-boiler-types';
import {
  getCentredBoxGrips,
  applyCentredBoxGripDrag,
  type CentredBoxGripRole,
} from '../grips/centred-box-grips';

// ─── Role ↔ boiler-kind maps ────────────────────────────────────────────────────

const ROLE_TO_KIND: Readonly<Record<CentredBoxGripRole, MepBoilerGripKind>> = {
  'move': 'mep-boiler-move',
  'rotation': 'mep-boiler-rotation',
  'corner-ne': 'mep-boiler-corner-ne',
  'corner-nw': 'mep-boiler-corner-nw',
  'corner-sw': 'mep-boiler-corner-sw',
  'corner-se': 'mep-boiler-corner-se',
};
const KIND_TO_ROLE: Readonly<Record<MepBoilerGripKind, CentredBoxGripRole>> = {
  'mep-boiler-move': 'move',
  'mep-boiler-rotation': 'rotation',
  'mep-boiler-corner-ne': 'corner-ne',
  'mep-boiler-corner-nw': 'corner-nw',
  'mep-boiler-corner-sw': 'corner-sw',
  'mep-boiler-corner-se': 'corner-se',
};

// ─── Grip emission ───────────────────────────────────────────────────────────

/**
 * Compute parametric grip positions for a `MepBoilerEntity` (6 grips, stable
 * order: move, rotation, 4 corners). Delegates to the shared box SSoT.
 */
export function getMepBoilerGrips(entity: Readonly<MepBoilerEntity>): GripInfo[] {
  return getCentredBoxGrips(entity.params).map((g) => ({
    entityId: entity.id,
    gripIndex: g.gripIndex,
    type: g.type,
    position: g.position,
    movesEntity: g.movesEntity,
    mepBoilerGripKind: ROLE_TO_KIND[g.role],
  }));
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

export interface MepBoilerGripDragInput {
  /** Original params at drag start (preserves invariants). */
  readonly originalParams: MepBoilerParams;
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
 * Pure transform: boiler grip kind + drag input → new `MepBoilerParams`.
 * Delegates to the shared box SSoT; zero delta / unknown kind → returns
 * `originalParams` referentially unchanged (commit short-circuit).
 */
export function applyMepBoilerGripDrag(
  kind: MepBoilerGripKind,
  input: Readonly<MepBoilerGripDragInput>,
): MepBoilerParams {
  const { originalParams } = input;
  const role = KIND_TO_ROLE[kind];
  if (!role) return originalParams;
  const patch = applyCentredBoxGripDrag(role, {
    originalParams,
    delta: input.delta,
    minDimensionMm: MIN_BOILER_DIMENSION_MM,
    ortho: input.ortho,
    ...(input.pivot ? { pivot: input.pivot } : {}),
    ...(input.currentPos ? { currentPos: input.currentPos } : {}),
  });
  if (!patch) return originalParams;
  return { ...originalParams, ...patch };
}
