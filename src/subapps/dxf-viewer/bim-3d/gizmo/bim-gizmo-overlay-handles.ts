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
 *   - column → NO resize handle. ADR-402 §gizmo-cleanup (Giorgio 2026-06-29): the vertical height
 *              octahedra («κίτρινα διαμαντάκια» στη θέση του κάθετου άξονα) read as
 *              confusing clutter. Height + base offset → contextual tab («Ύψος»);
 *              width/depth (X/Z) → Type. A column is a point in plan (no length).
 *   - wall   → NO resize handle. ADR-402 §gizmo-cleanup: same — the vertical octahedra removed.
 *              Height/base → tab; thickness (X/Z) → Type; LENGTH → the endpoint shape
 *              handles (`ENDPOINT_HANDLES_BY_TYPE`).
 *   - beam   → NO resize handle. ADR-535 Φ9: LENGTH + width → the 2D Canvas2D reshape
 *              grips (top/bottom faces, mirror slab/wall); depth → Type; top elevation →
 *              the vertical move arrow. (Endpoint rings removed — see ENDPOINT_HANDLES_BY_TYPE.)
 *   - slab   → NO resize handle. Thickness → Type; footprint → 2D per-vertex sketch.
 *   - stair  → NO resize handle. ADR-402 §gizmo-cleanup (Giorgio 2026-07-22): the plan +
 *              vertical octahedra («διαμαντάκια») read as confusing clutter here too — the
 *              LAST type still exposing them. Width/Πλάτος, run/Πλήθος Σκαλιών, height/Ύψος
 *              and base offset are ALL edited in the «Ιδιότητες Κλίμακας» contextual panel,
 *              so the 3D drag handles were redundant. Now EVERY BIM type is diamond-free.
 *
 * Result: `RESIZE_HANDLES_BY_TYPE` is intentionally EMPTY — no element type shows a resize
 * octahedron. The geometry is still built once (`gizmo-geometry.ts`) but `applyActiveHandles`
 * keeps every resize visual + hitbox hidden for all selections.
 */
const RESIZE_HANDLES_BY_TYPE: Readonly<Record<string, readonly GizmoHandleId[]>> = {};

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
 *   - `wall` / `beam` → ΧΩΡΙΣ endpoint rings (ADR-535 Φ9 beam· Φ8 follow-up wall): εκθέτουν
 *     πλέον τις ΙΔΙΕΣ 2D reshape grips (γωνίες/πάχος/μήκος-άκρα) ως Canvas2D overlay top+bottom,
 *     όπως η πλάκα — οι σιελ endpoint-σφαιρες του gizmo θα ήταν διπλή/συγκρουόμενη λαβή μήκους.
 *     (Το μήκος/άκρα του τοίχου τα καλύπτουν οι Φ8 reshape grips· τα openings ακολουθούν.)
 */
const ENDPOINT_HANDLES_BY_TYPE: Readonly<Record<string, readonly GizmoHandleId[]>> = {
  'mep-segment': ['endpoint-start', 'endpoint-end'],
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
 * SSoT gate — TRUE when `bimType` exposes draggable endpoint shape handles. The ONE source of
 * truth is `ENDPOINT_HANDLES_BY_TYPE` (only `mep-segment` after wall/beam moved to 2D reshape
 * grips, ADR-535 Φ8/Φ9). The endpoint-handle positioner reads THIS instead of its own type
 * list, so it never computes offsets for a type whose rings `applyActiveHandles` would hide
 * (was: wall/beam still positioned hidden handles — dead work + a 2nd source of the truth).
 */
export function hasEndpointHandles(bimType: string | null): boolean {
  return !!(bimType && ENDPOINT_HANDLES_BY_TYPE[bimType]?.length);
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
