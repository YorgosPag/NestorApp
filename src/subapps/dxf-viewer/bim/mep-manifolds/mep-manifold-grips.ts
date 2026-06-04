/**
 * ADR-408 Φ12 — Plumbing manifold parametric 2D grips (wall-parity).
 *
 * Thin adapter over the shared **centred rotatable-box** grip SSoT
 * (`bim/grips/centred-box-grips.ts`). A manifold is **always rectangular** (no
 * circular / diameter handle), so it delegates 100% to the SSoT and only maps the
 * entity-agnostic grip ROLES (`'move'` / `'rotation'` / `'corner-*'`) to/from the
 * manifold-specific grip-kind strings (`'mep-manifold-move'`, …) that the
 * discriminator unions + glyph / hot-grip / commit registries expect. 1:1 mirror
 * of `electrical-panel-grips.ts`.
 *
 * @see bim/grips/centred-box-grips.ts — the shared box SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, MepManifoldGripKind } from '../../hooks/grip-types';
import type { MepManifoldEntity, MepManifoldParams } from '../types/mep-manifold-types';
import { MIN_MANIFOLD_DIMENSION_MM } from '../types/mep-manifold-types';
import {
  getCentredBoxGrips,
  applyCentredBoxGripDrag,
  type CentredBoxGripRole,
} from '../grips/centred-box-grips';

// ─── Role ↔ manifold-kind maps ────────────────────────────────────────────────

const ROLE_TO_KIND: Readonly<Record<CentredBoxGripRole, MepManifoldGripKind>> = {
  'move': 'mep-manifold-move',
  'rotation': 'mep-manifold-rotation',
  'corner-ne': 'mep-manifold-corner-ne',
  'corner-nw': 'mep-manifold-corner-nw',
  'corner-sw': 'mep-manifold-corner-sw',
  'corner-se': 'mep-manifold-corner-se',
};
const KIND_TO_ROLE: Readonly<Record<MepManifoldGripKind, CentredBoxGripRole>> = {
  'mep-manifold-move': 'move',
  'mep-manifold-rotation': 'rotation',
  'mep-manifold-corner-ne': 'corner-ne',
  'mep-manifold-corner-nw': 'corner-nw',
  'mep-manifold-corner-sw': 'corner-sw',
  'mep-manifold-corner-se': 'corner-se',
};

// ─── Grip emission ───────────────────────────────────────────────────────────

/**
 * Compute parametric grip positions for a `MepManifoldEntity` (6 grips, stable
 * order: move, rotation, 4 corners). Delegates to the shared box SSoT.
 */
export function getMepManifoldGrips(entity: Readonly<MepManifoldEntity>): GripInfo[] {
  return getCentredBoxGrips(entity.params).map((g) => ({
    entityId: entity.id,
    gripIndex: g.gripIndex,
    type: g.type,
    position: g.position,
    movesEntity: g.movesEntity,
    mepManifoldGripKind: ROLE_TO_KIND[g.role],
  }));
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

export interface MepManifoldGripDragInput {
  /** Original params at drag start (preserves invariants). */
  readonly originalParams: MepManifoldParams;
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
 * Pure transform: manifold grip kind + drag input → new `MepManifoldParams`.
 * Delegates to the shared box SSoT; zero delta / unknown kind → returns
 * `originalParams` referentially unchanged (commit short-circuit).
 */
export function applyMepManifoldGripDrag(
  kind: MepManifoldGripKind,
  input: Readonly<MepManifoldGripDragInput>,
): MepManifoldParams {
  const { originalParams } = input;
  const role = KIND_TO_ROLE[kind];
  if (!role) return originalParams;
  const patch = applyCentredBoxGripDrag(role, {
    originalParams,
    delta: input.delta,
    minDimensionMm: MIN_MANIFOLD_DIMENSION_MM,
    ortho: input.ortho,
    ...(input.pivot ? { pivot: input.pivot } : {}),
    ...(input.currentPos ? { currentPos: input.currentPos } : {}),
  });
  if (!patch) return originalParams;
  return { ...originalParams, ...patch };
}
