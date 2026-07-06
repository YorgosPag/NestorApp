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
import {
  MIN_MANIFOLD_DIMENSION_MM,
  MIN_MANIFOLD_OUTLET_COUNT,
  MAX_MANIFOLD_OUTLET_COUNT,
} from '../types/mep-manifold-types';
import {
  getCentredBoxGrips,
  applyCentredBoxGripDrag,
  type CentredBoxGripRole,
} from '../grips/centred-box-grips';
import { clampOutletCount } from './mep-manifold-geometry';
import { mmScaleFor } from '../../utils/scene-units';
import { rotateVector } from '../grips/grip-math';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';

// ─── Role ↔ manifold-kind maps ────────────────────────────────────────────────

const ROLE_TO_KIND: Readonly<Record<CentredBoxGripRole, MepManifoldGripKind>> = {
  'move': 'mep-manifold-move',
  'rotation': 'mep-manifold-rotation',
  'corner-ne': 'mep-manifold-corner-ne',
  'corner-nw': 'mep-manifold-corner-nw',
  'corner-sw': 'mep-manifold-corner-sw',
  'corner-se': 'mep-manifold-corner-se',
};
// Partial: the outlet add/remove action kinds have NO centred-box role (they are
// single-click actions, not box drags) — `applyMepManifoldGripDrag` guards on the
// `undefined` lookup and short-circuits to `originalParams` for them.
const KIND_TO_ROLE: Readonly<Partial<Record<MepManifoldGripKind, CentredBoxGripRole>>> = {
  'mep-manifold-move': 'move',
  'mep-manifold-rotation': 'rotation',
  'mep-manifold-corner-ne': 'corner-ne',
  'mep-manifold-corner-nw': 'corner-nw',
  'mep-manifold-corner-sw': 'corner-sw',
  'mep-manifold-corner-se': 'corner-se',
};

// ─── Outlet action grips (Revit "array control" ▲/▼) ──────────────────────────

/** mm — stand-off of the outlet action grips beyond the +X (width) short end. */
const OUTLET_ACTION_GRIP_OFFSET_MM = 150;
/** mm — vertical gap between the ▲ add and ▼ remove action grips (local frame). */
const OUTLET_ACTION_GRIP_GAP_MM = 220;

/**
 * World position of an outlet action grip: stood off beyond the +X short end of
 * the bar (opposite the −X inlet), offset vertically in the manifold's local
 * frame by `localDyMm`, then rotated into world. Mirrors the centred-box frame
 * math (`rotateVector` + `mmScaleFor`) — no re-implemented cos/sin.
 */
function outletActionGripWorld(params: MepManifoldParams, localDyMm: number): Point2D {
  const s = mmScaleFor(params);
  const local = { x: (params.width / 2 + OUTLET_ACTION_GRIP_OFFSET_MM) * s, y: localDyMm * s };
  const rot = rotateVector(local, params.rotation);
  return translatePoint(params.position, rot);
}

// ─── Grip emission ───────────────────────────────────────────────────────────

/**
 * Compute parametric grip positions for a `MepManifoldEntity`: the 6 centred-box
 * grips (move, rotation, 4 corners) plus the Revit "array control" ▲/▼ outlet
 * action grips. The action grips are hidden at the clamp bounds (the ▲ disappears
 * at `MAX`, the ▼ at `MIN`) so a click is never a no-op — mirroring Revit
 * disabling the array arrow at the limit. Stable grip indices: 6 = add, 7 =
 * remove (independent of which is shown).
 */
export function getMepManifoldGrips(entity: Readonly<MepManifoldEntity>): GripInfo[] {
  const grips: GripInfo[] = getCentredBoxGrips(entity.params).map((g) => ({
    entityId: entity.id,
    gripIndex: g.gripIndex,
    type: g.type,
    position: g.position,
    movesEntity: g.movesEntity,
    mepManifoldGripKind: ROLE_TO_KIND[g.role],
  }));

  const params = entity.params;
  const count = clampOutletCount(params.outletCount);
  if (count < MAX_MANIFOLD_OUTLET_COUNT) {
    grips.push({
      entityId: entity.id,
      gripIndex: 6,
      type: 'center',
      position: outletActionGripWorld(params, OUTLET_ACTION_GRIP_GAP_MM / 2),
      movesEntity: false,
      mepManifoldGripKind: 'mep-manifold-outlet-add',
    });
  }
  if (count > MIN_MANIFOLD_OUTLET_COUNT) {
    grips.push({
      entityId: entity.id,
      gripIndex: 7,
      type: 'center',
      position: outletActionGripWorld(params, -OUTLET_ACTION_GRIP_GAP_MM / 2),
      movesEntity: false,
      mepManifoldGripKind: 'mep-manifold-outlet-remove',
    });
  }
  return grips;
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
