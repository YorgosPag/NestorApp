/**
 * ADR-408 DHW — Domestic hot water heater parametric 2D grips (wall-parity).
 *
 * Thin adapter over the shared **centred rotatable-box** grip SSoT
 * (`bim/grips/centred-box-grips.ts`). A water heater is **always rectangular** (no
 * circular / diameter handle), so it delegates 100% to the SSoT and only maps the
 * entity-agnostic grip ROLES (`'move'` / `'rotation'` / `'corner-*'`) to/from the
 * water-heater-specific grip-kind strings (`'mep-water-heater-move'`, …) that the
 * discriminator unions + glyph / hot-grip / commit registries expect. 1:1 mirror
 * of `mep-boiler-grips.ts`.
 *
 * NOTE: `mepWaterHeaterGripKind` is not yet a field on the shared `GripInfo`
 * interface (it will be added in the next integration step together with the commit
 * adapter and unified-grip-types wiring). Until then the emitted `GripInfo` carries
 * the kind in an intersection type so callers can narrow it safely without changing
 * any shared file in this slice.
 *
 * @see bim/grips/centred-box-grips.ts — the shared box SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, MepWaterHeaterGripKind } from '../../hooks/grip-types';
import type { MepWaterHeaterEntity, MepWaterHeaterParams } from '../types/mep-water-heater-types';
import { MIN_WATER_HEATER_DIMENSION_MM } from '../types/mep-water-heater-types';
import {
  getCentredBoxGrips,
  applyCentredBoxGripDrag,
  type CentredBoxGripRole,
} from '../grips/centred-box-grips';

// Re-export so callers that imported from here keep working.
export type { MepWaterHeaterGripKind };

/** `GripInfo` augmented with the water-heater grip kind discriminator. */
export type MepWaterHeaterGripInfo = GripInfo & {
  readonly mepWaterHeaterGripKind: MepWaterHeaterGripKind;
};

// ─── Role ↔ water-heater-kind maps ──────────────────────────────────────────────

const ROLE_TO_KIND: Readonly<Record<CentredBoxGripRole, MepWaterHeaterGripKind>> = {
  'move':      'mep-water-heater-move',
  'rotation':  'mep-water-heater-rotation',
  'corner-ne': 'mep-water-heater-corner-ne',
  'corner-nw': 'mep-water-heater-corner-nw',
  'corner-sw': 'mep-water-heater-corner-sw',
  'corner-se': 'mep-water-heater-corner-se',
};

const KIND_TO_ROLE: Readonly<Record<MepWaterHeaterGripKind, CentredBoxGripRole>> = {
  'mep-water-heater-move':      'move',
  'mep-water-heater-rotation':  'rotation',
  'mep-water-heater-corner-ne': 'corner-ne',
  'mep-water-heater-corner-nw': 'corner-nw',
  'mep-water-heater-corner-sw': 'corner-sw',
  'mep-water-heater-corner-se': 'corner-se',
};

// ─── Grip emission ───────────────────────────────────────────────────────────

/**
 * Compute parametric grip positions for a `MepWaterHeaterEntity` (6 grips, stable
 * order: move, rotation, 4 corners). Delegates to the shared box SSoT.
 */
export function getMepWaterHeaterGrips(
  entity: Readonly<MepWaterHeaterEntity>,
): MepWaterHeaterGripInfo[] {
  return getCentredBoxGrips(entity.params).map((g) => ({
    entityId: entity.id,
    gripIndex: g.gripIndex,
    type: g.type,
    position: g.position,
    movesEntity: g.movesEntity,
    mepWaterHeaterGripKind: ROLE_TO_KIND[g.role],
  }));
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

export interface MepWaterHeaterGripDragInput {
  /** Original params at drag start (preserves invariants). */
  readonly originalParams: MepWaterHeaterParams;
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
 * Pure transform: water heater grip kind + drag input → new `MepWaterHeaterParams`.
 * Delegates to the shared box SSoT; zero delta / unknown kind → returns
 * `originalParams` referentially unchanged (commit short-circuit).
 */
export function applyMepWaterHeaterGripDrag(
  kind: MepWaterHeaterGripKind,
  input: Readonly<MepWaterHeaterGripDragInput>,
): MepWaterHeaterParams {
  const { originalParams } = input;
  const role = KIND_TO_ROLE[kind];
  if (!role) return originalParams;
  const patch = applyCentredBoxGripDrag(role, {
    originalParams,
    delta: input.delta,
    minDimensionMm: MIN_WATER_HEATER_DIMENSION_MM,
    ortho: input.ortho,
    ...(input.pivot     ? { pivot:      input.pivot }      : {}),
    ...(input.currentPos ? { currentPos: input.currentPos } : {}),
  });
  if (!patch) return originalParams;
  return { ...originalParams, ...patch };
}
