/**
 * bim-gizmo-overlay-handles.ts — per-entity-type handle-set tables + the pure
 * resolvers that derive the active handle ids for a selection.
 *
 * Split out of `bim-gizmo-overlay.ts` (ADR-402/408) to keep the scene-side class
 * under the 500-line file budget (N.7.1). No Three.js, no class state — pure data
 * + logic; the overlay class consumes `activeHandlesFor`/`isPlanarMoveType`.
 */

import type { GizmoHandleId } from './gizmo-types';

/**
 * Move/rotate handles active for EVERY selected entity (the planar baseline).
 * ADR-402/408 Φ-E — Revit DOF model: structural + non-MEP elements move in PLAN
 * only (2-axis): the two horizontal arrows (`axis-x`/`axis-z`), the horizontal plane
 * drag (`plane-xz`) and the plan rotation ring (`rotate-y`). Their vertical position
 * is a constraint/offset edited via the contextual tab — NOT a free 3D drag — so the
 * vertical move arrow (`axis-y`) and the vertical plane handles are NOT in the base.
 * (`center` orange free-move pyramid hidden per Giorgio.)
 */
export const BASE_HANDLES: readonly GizmoHandleId[] = [
  'axis-x', 'axis-z', 'plane-xz', 'rotate-y',
];

/**
 * ADR-408 Φ-E — handles that turn a selection into a FULL 3D move: the vertical move
 * arrow (`axis-y`) + the two vertical plane drags (`plane-xy`, `plane-yz`). Added only
 * for the `FREE_3D_MOVE_TYPES` below.
 */
const FREE_3D_MOVE_HANDLES: readonly GizmoHandleId[] = ['axis-y', 'plane-xy', 'plane-yz'];

/**
 * ADR-408 Φ-E — entity types that move freely in ALL THREE axes (Revit: ducts/pipes +
 * mechanical equipment placed at an arbitrary elevation). Everything else is planar
 * (2-axis). Multi-select (`editBimType = null`) → planar (mirror resize/tilt).
 */
const FREE_3D_MOVE_TYPES: ReadonlySet<string> = new Set([
  'mep-segment', 'mep-fixture', 'mep-manifold', 'mep-radiator', 'mep-boiler', 'mep-water-heater',
]);

/**
 * ADR-402 Phase B / ADR-408 Φ1 — extra resize handles shown per entity type. The
 * mapping is Revit-FAITHFUL: a shape handle edits ONLY a "stretch" (length/height);
 * cross-section thickness/width/depth is NEVER a drag — it is a Type parameter
 * (contextual ribbon). So the structural plan-section handles (`resize-x`/`resize-z`
 * = wall/column thickness, beam width) and the slab thickness handle were REMOVED
 * (ADR-408 Φ1, «πιστή αντιγραφή Revit»):
 *   - column → Y-top height + Y-base offset ONLY (ADR-401 F.3 top/base octahedra).
 *              Width/depth (X/Z) → Type. Length n/a (a column is a point in plan).
 *   - wall   → Y-top height + Y-base offset ONLY (ADR-401 E.3). Thickness (X/Z) →
 *              Type. LENGTH → the endpoint shape handles (`ENDPOINT_HANDLES_BY_TYPE`).
 *   - beam   → NO resize handle. ADR-535 Φ9: LENGTH + width → the 2D Canvas2D reshape
 *              grips (top/bottom faces, mirror slab/wall); depth → Type; top elevation →
 *              the vertical move arrow. (Endpoint rings removed — see ENDPOINT_HANDLES_BY_TYPE.)
 *   - slab   → NO resize handle. Thickness → Type; footprint → 2D per-vertex sketch.
 */
const RESIZE_HANDLES_BY_TYPE: Readonly<Record<string, readonly GizmoHandleId[]>> = {
  // `resize-m-y` = the second (base) vertical grip below the centroid (top + base).
  column: ['resize-y', 'resize-m-y'],
  wall: ['resize-y', 'resize-m-y'],
  // ADR-402 Sub-Phase 1 — stair: plan handles (perp → width, axial → run/stepCount).
  // ADR-401 Phase G.3 — + vertical top/base octahedra: dragging re-steps to the new
  // height (Revit «Desired number of risers») and detaches the side if attached.
  // Unchanged by ADR-408 Φ1 (a stair's incline IS its parametric run, not a section).
  stair: ['resize-x', 'resize-z', 'resize-y', 'resize-m-y'],
};

/**
 * ADR-404 Phase 2 — X/Z rotate rings shown per entity type so the user can TILT
 * (rake a column, batter a wall, ramp a beam, slope a slab). Both X and Z rings are
 * offered; the drag bridge maps each to the type's tilt DOF and treats a roll ring
 * (axis along the element) as a no-op. A stair has NO tilt (its incline is parametric
 * via run/stepCount — Revit-correct), so it is absent here. Single-select only: a
 * multi-selection reports `editBimType = null` → no tilt rings (mirror resize).
 */
const TILT_HANDLES_BY_TYPE: Readonly<Record<string, readonly GizmoHandleId[]>> = {
  column: ['rotate-x', 'rotate-z'],
  wall: ['rotate-x', 'rotate-z'],
  beam: ['rotate-x', 'rotate-z'],
  slab: ['rotate-x', 'rotate-z'],
};

/**
 * ADR-408 Φ-D/Φ1 — per-endpoint shape handles shown per entity type. A linear element
 * exposes a draggable handle at each axis end (drag ONE end → it stretches from there,
 * the other end stays). Single-select only (the hook passes `editBimType = null` for a
 * multi-selection → no endpoint handles, mirror resize).
 *   - `mep-segment` → Revit pipe shape handles (free-3D drag: κάτοψη + υψόμετρο).
 *   - `wall` → Revit LENGTH shape handles (horizontal drag: το μήκος είναι plan
 *     dimension· το ύψος είναι ξεχωριστή λαβή/Τύπος).
 *   - `beam` → ΧΩΡΙΣ endpoint rings (ADR-535 Φ9): το δοκάρι πλέον εκθέτει τις ΙΔΙΕΣ
 *     2D reshape grips (γωνίες/πλάτος/μήκος-άκρα) ως Canvas2D overlay top+bottom, όπως η
 *     πλάκα/τοίχος — οι σιελ endpoint-σφαιρες του gizmo θα ήταν διπλή/συγκρουόμενη λαβή μήκους.
 */
const ENDPOINT_HANDLES_BY_TYPE: Readonly<Record<string, readonly GizmoHandleId[]>> = {
  'mep-segment': ['endpoint-start', 'endpoint-end'],
  wall: ['endpoint-start', 'endpoint-end'],
};

/** Active handle id set for a selected entity: base move/rotate + 3D move + resize + tilt + endpoint. */
export function activeHandlesFor(bimType: string | null): ReadonlySet<GizmoHandleId> {
  const ids = new Set<GizmoHandleId>(BASE_HANDLES);
  // ADR-408 Φ-E — full 3D move (vertical arrow + vertical planes) only for free-3D types.
  if (bimType && FREE_3D_MOVE_TYPES.has(bimType)) for (const id of FREE_3D_MOVE_HANDLES) ids.add(id);
  const resize = (bimType && RESIZE_HANDLES_BY_TYPE[bimType]) || [];
  for (const id of resize) ids.add(id);
  const tilt = (bimType && TILT_HANDLES_BY_TYPE[bimType]) || [];
  for (const id of tilt) ids.add(id);
  const endpoints = (bimType && ENDPOINT_HANDLES_BY_TYPE[bimType]) || [];
  for (const id of endpoints) ids.add(id);
  return ids;
}

/**
 * ADR-363 Φ1G.5 Slice 2h — a PLANAR (non-free-3D) single selection whose move handles
 * are all in `BASE_HANDLES`. Such a drag can safely collapse the gizmo to the move
 * arrows (hiding resize/endpoint/tilt clutter, Revit-style) without ever hiding the
 * handle being dragged. Free-3D MEP types keep their handles (their active handle may
 * be `axis-y`/`plane-xy`/`plane-yz`, which are NOT in the base).
 */
export function isPlanarMoveType(bimType: string | null): boolean {
  return bimType !== null && !FREE_3D_MOVE_TYPES.has(bimType);
}
