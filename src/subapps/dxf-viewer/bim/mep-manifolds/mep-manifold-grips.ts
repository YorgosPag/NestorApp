/**
 * ADR-408 Φ12 — Plumbing manifold parametric 2D grips (wall-parity).
 *
 * The centred rotatable-box part (move / rotation / 4 corners) is a PURE centred-box
 * consumer, delegated to the shared box grip SSoT via the
 * `createCentredBoxGripAdapter` factory (ADR-602). On TOP of that the manifold adds
 * the Revit "array control" ▲/▼ outlet action grips — an affordance OUTSIDE a
 * centred rectangle — so it composes the adapter as an ESCAPE-HATCH (No-God-shell):
 * `getMepManifoldGrips` calls `adapter.getGrips` then appends the outlet grips, and
 * `applyMepManifoldGripDrag` IS `adapter.applyGripDrag` (the outlet kinds have no
 * box role → the adapter short-circuits to `originalParams`; they are single-click
 * ACTION grips committed elsewhere via `commitMepManifoldOutletCountGrip`).
 *
 * @see bim/grips/create-centred-box-grip-adapter.ts — the adapter factory (ADR-602)
 * @see bim/grips/centred-box-grips.ts — the shared box geometry + drag SSoT
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
  createCentredBoxGripAdapter,
  buildCentredBoxKindMaps,
  type CentredBoxAdapterDragInput,
} from '../grips/create-centred-box-grip-adapter';
import { clampOutletCount } from './mep-manifold-geometry';
import { mmScaleFor } from '../../utils/scene-units';
import { rotateVector } from '../grips/grip-math';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';

const adapter = createCentredBoxGripAdapter<
  MepManifoldEntity,
  MepManifoldParams,
  MepManifoldGripKind
>({
  ...buildCentredBoxKindMaps('mep-manifold'),
  minDimensionMm: MIN_MANIFOLD_DIMENSION_MM,
  toBoxParams: (params) => params,
  fromBoxPatch: (original, patch) => ({ ...original, ...patch }),
  toGripInfo: (base, kind) => ({ ...base, mepManifoldGripKind: kind, gripKind: { on: 'mep-manifold', kind } }),
});

/** Drag input for a manifold grip (the shared centred-box 5-field shape). */
export type MepManifoldGripDragInput = CentredBoxAdapterDragInput<MepManifoldParams>;

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
 * Compute parametric grip positions for a `MepManifoldEntity`: the centred-box
 * grips (rotation + 4 corners) plus the Revit "array control" ▲/▼ outlet action
 * grips. The action grips are hidden at the clamp bounds (the ▲ disappears at
 * `MAX`, the ▼ at `MIN`) so a click is never a no-op — mirroring Revit disabling
 * the array arrow at the limit. Stable grip indices: 6 = add, 7 = remove
 * (independent of which is shown).
 */
export function getMepManifoldGrips(entity: Readonly<MepManifoldEntity>): GripInfo[] {
  const grips = adapter.getGrips(entity);

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
      gripKind: { on: 'mep-manifold', kind: 'mep-manifold-outlet-add' },
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
      gripKind: { on: 'mep-manifold', kind: 'mep-manifold-outlet-remove' },
    });
  }
  return grips;
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

/**
 * Pure transform: manifold grip kind + drag input → new `MepManifoldParams`.
 * Delegates to the shared box SSoT; the outlet ▲/▼ kinds have no box role so the
 * adapter returns `originalParams` referentially unchanged (they are single-click
 * actions handled by `commitMepManifoldOutletCountGrip`). Zero delta / unknown
 * kind → `originalParams` unchanged (commit short-circuit).
 */
export const applyMepManifoldGripDrag: (
  kind: MepManifoldGripKind,
  input: Readonly<MepManifoldGripDragInput>,
) => MepManifoldParams = adapter.applyGripDrag;
