/**
 * ADR-183: Unified Grip System — Commit Adapters
 *
 * Adapters that know how to COMMIT a grip drag for each source system.
 * Extracted from useDxfGripInteraction (DXF) and useCanvasMouse (overlay).
 *
 * Pattern: Strategy — the unified hook delegates commit to the right adapter
 * based on `grip.source`.
 *
 * @see useDxfGripInteraction.ts — original DXF commit (commitGripDelta, createSceneManagerAdapter)
 * @see useCanvasMouse.ts — original overlay commit (handleContainerMouseUp)
 * @see grip-scene-manager-adapter.ts — ISceneManager adapter (split for N.7.1 file-size compliance)
 */
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands/interfaces';
import type { VertexMovement } from '../../core/commands';
import type { SceneModel } from '../../types/scene';
import type { useOverlayStore } from '../../overlays/overlay-store';
import type { UnifiedGripInfo } from './unified-grip-types';
import { type GripMode } from '../../systems/grip/grip-mode-cycle';
import { GripHandoffStore } from '../../systems/grip/GripHandoffStore';
import { gripToVertexRefs } from '../../systems/grip/grip-to-vertex-refs';
import { collectCoincidentLinePartnerMoves } from '../../systems/stretch/coincident-endpoint-comove';
import { SelectedEntitiesStore } from '../../systems/selection/SelectedEntitiesStore';
import { StretchEntityCommand, type StretchParams } from '../../core/commands/entity-commands/StretchEntityCommand';
import { CopyEntityCommand, type CopyEntityParams } from '../../core/commands/entity-commands/CopyEntityCommand';
import { GripCopyModeStore } from '../../systems/grip/GripCopyModeStore';
import { isGripCopyIntent } from '../../systems/grip/grip-copy-intent';
import { isActiveGripAltMove } from '../../systems/cursor/GripDragStore';
import { executeWholeEntityConnectivityMove } from '../../bim/mep-segments/build-whole-entity-connectivity-move';
import type { Entity } from '../../types/entities';
export type { DxfCommitDeps, OverlayCommitDeps } from './unified-grip-types';
import type { DxfCommitDeps, OverlayCommitDeps } from './unified-grip-types';
// ISceneManager adapter extracted to sibling module (N.7.1 file-size compliance)
export { createSceneManagerAdapter } from './grip-scene-manager-adapter';
import { createSceneManagerAdapter } from './grip-scene-manager-adapter';
// ============================================================================
// DXF GRIP COMMIT
// ============================================================================
/** ADR-349 Phase 1c-B3 — commit via StretchEntityCommand (vertex refs or anchor moves). */
export function commitDxfGripDragViaStretchCommand(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (delta.x === 0 && delta.y === 0) return;
  if (!grip.entityId) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const entity = sceneManager.getEntity(grip.entityId);
  if (!entity) return;
  const refs = gripToVertexRefs(entity as unknown as Entity, grip);
  const vertexMoves = refs.length > 0 ? [{ entityId: grip.entityId, refs }] : [];
  const anchorMoves = refs.length === 0 && grip.movesEntity ? [grip.entityId] : [];
  if (vertexMoves.length === 0 && anchorMoves.length === 0) return;

  // ADR-543 — articulated joint: when ≥2 lines are selected and the dragged
  // endpoint is coincident with another selected line's endpoint, co-move both
  // endpoints in ONE command. Works in 2D AND 3D (both pass through this seam).
  const partnerMoves = collectCoincidentLinePartnerMoves({
    draggedEntity: entity as unknown as Entity,
    draggedRefs: refs,
    selectedEntityIds: SelectedEntitiesStore.getSelectedEntityIds(),
    getEntity: (id) => sceneManager.getEntity(id) as unknown as Entity | undefined,
  });

  // ADR-357 Phase 12 — when the grip-context-menu "Copy" toggle is ON, route
  // through `CopyEntityCommand` so the source entity is preserved and a fresh
  // clone receives the displacement. Same vertex / anchor split as Stretch.
  if (GripCopyModeStore.getSnapshot().enabled) {
    const params: CopyEntityParams = { vertexMoves, anchorMoves, displacement: delta };
    const command = new CopyEntityCommand(params, sceneManager);
    if (command.validate() !== null) return;
    deps.execute(command);
    GripCopyModeStore.bumpCount();
    return;
  }

  // Co-move partners ride only the StretchEntityCommand path. Copy-mode (above)
  // keeps single-entity clone semantics intentionally.
  const params: StretchParams = {
    vertexMoves: [...vertexMoves, ...partnerMoves],
    anchorMoves,
    displacement: delta,
  };
  const command = new StretchEntityCommand(params, sceneManager);
  if (command.validate() !== null) return;
  deps.execute(command);
}
// Parametric commit handlers live in ./grip-parametric-commits.ts. The uniform
// params-driven BIM dispatch (stair … ray) is extracted to ./grip-parametric-
// dispatch.ts (N.7.1 file-size split); only the handlers still referenced by the
// primitive / whole-entity / action-grip paths below are imported directly here.
import {
  commitOpeningGripDrag,
  commitOpeningAltMove,
  commitMepManifoldOutletCountGrip,
  commitPolylineBulgeGripDrag,
  commitTextGripDrag,
  commitLineGripDrag,
  commitArcGripDrag,
  commitPolylineRotationGripDrag,
  commitAnnotationSymbolGripDrag,
  commitAnnotationSymbolResizeGripDrag,
  commitGroupGizmoRotation,
  commitBlockBoxScaleGripDrag,
} from './grip-parametric-commits';
import { isBlockBoxGripKind } from '../../systems/block/block-box-grips';
import { tryCommitParametricGripDrag } from './grip-parametric-dispatch';
import { gripKindOf } from '../grip-kinds';
/**
 * ADR-363 Phase 1G.5 — whole-entity "move from characteristic point" (AutoCAD
 * base-point move). Translates the ENTIRE entity by `delta` via
 * `deps.moveEntities` (→ MoveEntityCommand → `calculateBimMovedGeometry`), or
 * clones it with the same displacement when `copy` is set (CopyEntityCommand,
 * copy-with-base-point). Shared SSoT for the `mode === 'move'` branch AND the
 * Alt-modifier bypass so both routes stay byte-identical.
 *
 * ADR-627 — exported so the hatch MOVE cross (`commitHatchGripDrag`) reuses the EXACT
 * same whole-entity translate + copy-with-base-point path (the hatch grip is intercepted
 * by `tryCommitParametricGripDrag` on `on:'hatch'` before this file's own move gate runs,
 * so it cannot fall through here — it calls this SSoT directly instead of duplicating it).
 */
export function commitWholeEntityMove(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
  copy: boolean,
): void {
  if (!grip.entityId) return;
  if (copy) {
    const sceneManager = createSceneManagerAdapter(deps);
    if (!sceneManager) return;
    const params: CopyEntityParams = { vertexMoves: [], anchorMoves: [grip.entityId], displacement: delta };
    const command = new CopyEntityCommand(params, sceneManager);
    if (command.validate() !== null) return;
    deps.execute(command);
    GripCopyModeStore.bumpCount();
    return;
  }
  // ADR-408 Φ-C (move-from-point side) — when the moved entity is a plumbing
  // connector host (sink / manifold / boiler / radiator / water-heater), its
  // connected pipe ends must FOLLOW it (Revit "host moves, connectors move with
  // it"). The parametric grip path already does this via
  // `executeHostMoveWithConnectedPipes`; this whole-entity / Alt move-from-point
  // path historically used a bare `MoveEntityCommand` (connectivity-blind), so the
  // run tore off the network. Route plumbing hosts through the SAME shared executor
  // (one CompoundCommand = single undo). Returns false for non-plumbing entities →
  // fall back to the standard move (walls / furniture / panels stay byte-identical).
  const sceneManager = createSceneManagerAdapter(deps);
  if (
    sceneManager &&
    executeWholeEntityConnectivityMove({ entityId: grip.entityId, delta, sceneManager, execute: deps.execute })
  ) {
    return;
  }
  deps.moveEntities([grip.entityId], delta, { isDragging: false });
}

/** ADR-349 Phase 1c-A/B2/B3 — mode-aware DXF grip commit (stretch/move/rotate/scale/mirror). */
export function commitDxfGripDragModeAware(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
  mode: GripMode,
): void {
  // ADR-602 Stage 4 — hoisted tagged-kind reads: this dispatcher branches on 8
  // entity discriminators (several 2-3× each), so each `<obj>.<x>GripKind` legacy
  // field is read via `gripKindOf` ONCE here and reused below.
  const openingKind = gripKindOf(grip, 'opening');
  const mepManifoldKind = gripKindOf(grip, 'mep-manifold');
  const arcKind = gripKindOf(grip, 'arc');
  const polylineKind = gripKindOf(grip, 'polyline');
  const annotationSymbolKind = gripKindOf(grip, 'annotation-symbol');
  const groupKind = gripKindOf(grip, 'group');
  const blockKind = gripKindOf(grip, 'block');
  const textKind = gripKindOf(grip, 'text');
  const lineKind = gripKindOf(grip, 'line');
  // Opening flip actions (Revit-style «Flip Hand» + «Flip Facing») are click-to-toggle
  // — they must fire even on zero delta (no drag), so they precede the zero-delta guard.
  if (openingKind === 'opening-rotation' || openingKind === 'opening-facing') {
    commitOpeningGripDrag(grip, delta, deps);
    return;
  }
  // ADR-408 Φ12 — manifold outlet add/remove are single-click ACTION grips (Revit
  // "array control" ▲/▼): they bump `outletCount` ±1 and must fire even on zero
  // delta (no drag), so they also precede the zero-delta guard.
  // ADR-408 Φ-C EXT — but ONLY when Alt is NOT armed: the ▲/▼ grips sit ~150mm off
  // the manifold edge, so an Alt+drag «move-from-point» can grab one. With Alt held
  // the user intends a WHOLE-ENTITY move (connectivity-preserving), not an outlet
  // bump — fall through to the Alt branch below so the manifold actually moves.
  if (
    !isActiveGripAltMove() &&
    (mepManifoldKind === 'mep-manifold-outlet-add' ||
      mepManifoldKind === 'mep-manifold-outlet-remove')
  ) {
    commitMepManifoldOutletCountGrip(grip, deps);
    return;
  }
  if (delta.x === 0 && delta.y === 0) return;
  if (!grip.entityId) return;
  // ADR-363 Phase 1G.5 / ADR-560 — Alt-armed drag → whole-entity "move from
  // characteristic point" (AutoCAD base-point move). Read via the blur-proof SSoT
  // resolver (`isActiveGripAltMove`): the flag is baked at grip mousedown from the
  // native `e.altKey`, so it survives the whole drag even if Alt is released or the
  // Windows Alt→blur clears the live store mid-gesture. Bypasses EVERY parametric
  // grip path below: the grabbed grip (corner / endpoint / midpoint / thickness /
  // corner-resize) becomes the base point — `delta` is already measured from
  // `grip.position` upstream — so the WHOLE entity translates instead of
  // reshaping. Alt+Ctrl (or the right-click Copy toggle) clones with the same
  // base point. Sole move-from-point path for params-driven BIM entities, whose
  // parametric returns otherwise pre-empt the `mode === 'move'` branch far below.
  if (isActiveGripAltMove()) {
    // ADR-363 Φ1G.5 Slice 2 — a hosted opening cannot free-translate (it lives ON
    // a wall; `calculateBimMovedGeometry` no-ops for it). Slide it ALONG the host
    // wall instead — base point = grabbed grip, displacement projected onto the
    // wall axis — so Alt+drag from any opening grip moves it the same gesture as a
    // free entity, just constrained to its wall. (Flip grips return earlier.)
    if (openingKind) {
      commitOpeningAltMove(grip, delta, deps);
      return;
    }
    commitWholeEntityMove(grip, delta, deps, isGripCopyIntent());
    return;
  }
  // ADR-183 / N.7.1 — params-driven BIM entity grips (stair, dimension, wall,
  // slab, roof, beam, column, foundation, every MEP kind, floor-finish, hatch,
  // xline, ray) dispatch to their dedicated commit handlers via the extracted
  // SSoT. Returns true when it handled the grip; on a miss we fall through to the
  // primitive / whole-entity paths below (arc / polyline / annotation / group /
  // text / line rotation & move, then the mode dispatch).
  if (tryCommitParametricGripDrag(grip, delta, deps)) return;
  // ADR-561 — arc ROTATION handle → rotate the arc about its centre via the
  // canonical `RotateEntityCommand`. The `'arc-move'` centre carries an
  // `arcGripKind` too but is a whole-entity TRANSLATE — it must fall through to the
  // move/stretch path below (mirror the line's `'line-move'` gate), so gate to
  // `'arc-rotation'` ONLY.
  if (arcKind === 'arc-rotation') {
    commitArcGripDrag(grip, delta, deps);
    return;
  }
  // ADR-561 — polyline ROTATION handle → rotate all vertices (a scene rectangle
  // explodes to a polyline first). Gate to `'polyline-rotation'` ONLY — the
  // `'polyline-move'` cross + the vertex / segment / arc-apex grips fall through.
  if (polylineKind === 'polyline-rotation') {
    commitPolylineRotationGripDrag(grip, delta, deps);
    return;
  }
  // ADR-583 — annotation symbol (North arrow) ROTATION handle → rotate about the
  // insertion point via the canonical `RotateEntityCommand`. Gate to
  // `'annotation-symbol-rotation'` ONLY — the `'annotation-symbol-move'` cross is a
  // whole-entity TRANSLATE (`movesEntity`) and must fall through to the move path.
  if (annotationSymbolKind === 'annotation-symbol-rotation') {
    commitAnnotationSymbolGripDrag(grip, delta, deps);
    return;
  }
  // ADR-583 Φ3 — annotation symbol CORNER resize handle → UNIFORM scale of the annotative
  // `sizeMm` about the insertion point via `applyAnnotationSymbolGripDrag` → `UpdateEntityCommand`
  // (flat `{ sizeMm }` patch, preview ≡ commit). Gate to the 4 corner kinds ONLY — the move
  // cross + rotation handle are handled above; a symbol has no vertices, so the stretch path
  // cannot serve this parametric resize.
  if (annotationSymbolKind?.startsWith('annotation-symbol-corner-')) {
    commitAnnotationSymbolResizeGripDrag(grip, delta, deps);
    return;
  }
  // ADR-575 §8 — GROUP gizmo ROTATION handle → rotate the whole group about its bbox
  // centre via the canonical `RotateEntityCommand` (`rotateEntity` case 'group' recurses
  // members). Gate to `'group-rotation'` ONLY — the `'group-move'` cross is a whole-group
  // TRANSLATE (handled just below).
  if (groupKind === 'group-rotation') {
    commitGroupGizmoRotation(grip, delta, deps);
    return;
  }
  // ADR-575 §8 — GROUP gizmo MOVE cross → translate the whole group DETERMINISTICALLY
  // (mode-independent, mirror `line-move`) via the whole-entity move SSoT
  // (`deps.moveEntities` → `MoveEntityCommand` → `calculateMovedGeometry` case 'group' →
  // recurse members). Ctrl / «Copy» clones with the same base point.
  if (groupKind === 'group-move') {
    commitWholeEntityMove(grip, delta, deps, isGripCopyIntent());
    return;
  }
  // ADR-640 — BLOCK gizmo ROTATION handle → rotate the whole block about its bbox centre
  // via the SAME canonical `RotateEntityCommand` the group uses (`rotateEntity` case
  // 'block' rotates the insertion point + accumulates rotation, INSERT semantics). The
  // shared `commitGroupGizmoRotation` resolves the container bounds by `raw.type`.
  if (blockKind === 'block-rotation') {
    commitGroupGizmoRotation(grip, delta, deps);
    return;
  }
  // ADR-640 — BLOCK gizmo MOVE cross → translate the whole block DETERMINISTICALLY via the
  // whole-entity move SSoT (`deps.moveEntities` → `MoveEntityCommand` → `calculateMovedGeometry`
  // case 'block' → translate `position`). Ctrl / «Copy» clones. Mirror `group-move`.
  if (blockKind === 'block-move') {
    commitWholeEntityMove(grip, delta, deps, isGripCopyIntent());
    return;
  }
  // ADR-641 — BLOCK selection-box CORNER / EDGE handle → per-axis SCALE of the whole block
  // (opposite corner/edge fixed) via the block scale SSoT (`scaleEntity` case 'block') →
  // `UpdateEntityCommand` with a `{ position, scale }` INSERT patch (definition members
  // immutable). Gate to the 8 box kinds ONLY — the move cross + rotation handle are handled
  // above, and a block container has no vertices so the stretch path cannot serve this scale.
  if (isBlockBoxGripKind(blockKind)) {
    commitBlockBoxScaleGripDrag(grip, delta, deps);
    return;
  }
  // ADR-583 — annotation symbol (North arrow) MOVE cross → translate the whole
  // entity DETERMINISTICALLY (mode-independent, mirror `group-move`) via the
  // whole-entity move SSoT (`MoveEntityCommand` → `calculateMovedGeometry` case
  // 'annotation-symbol'). The insertion point is not a vertex, so the stretch path
  // (line-move) cannot serve — this position-anchored move is the correct SSoT.
  if (annotationSymbolKind === 'annotation-symbol-move') {
    commitWholeEntityMove(grip, delta, deps, isGripCopyIntent());
    return;
  }
  // ADR-510 Φ3c — polyline ARC-MIDPOINT grip → live bulge curvature drag (the
  // apex follows the cursor). Only the arc-apex grip routes here; vertex +
  // straight-segment-midpoint polyline grips fall through to the standard
  // stretch path below (move vertex / move both edge vertices).
  if (polylineKind?.startsWith('polyline-arc-midpoint-')) {
    commitPolylineBulgeGripDrag(grip, delta, deps);
    return;
  }
  // ADR-557 — text/mtext rect-box grip path (4 corners + 4 edges + centre move +
  // rotation). Bypasses stretch because the box transform is computed by the shared
  // `applyTextGripDrag` and written to the flat top-level fields atomically by
  // `UpdateTextTransformCommand`. Covers BOTH TEXT (`widthFactor`) and MTEXT (`width`).
  if (textKind) {
    commitTextGripDrag(grip, delta, deps);
    return;
  }
  // ADR-363 Slice F — plain DXF line ROTATION grip path. Bypasses stretch/move
  // because rotation is not a single displacement: routes through the canonical
  // `RotateEntityCommand` (undoable, merge-coalescing) reading the picked pivot
  // from `BimRotateHotGripStore`. Full wall-rotation parity, no bespoke transform.
  // ⚠️ Slice G.5: gate to `'line-rotation'` ONLY — the line MOVE grip ALSO carries a
  // `lineGripKind` (`'line-move'`) but is a whole-entity TRANSLATE (movesEntity +
  // edgeVertexIndices [0,1]); it must fall through to the move/stretch path below,
  // exactly like the centre midpoint grip. A bare `if (grip.lineGripKind)` here sent
  // the move grip into rotation → the ¼-west arms produced a swept-angle no-op/spin.
  if (lineKind === 'line-rotation') {
    commitLineGripDrag(grip, delta, deps);
    return;
  }
  // ADR-363 Slice G.5 — plain DXF line ¼-west MOVE cross → whole-line TRANSLATE,
  // committed DETERMINISTICALLY (mode-independent) via the canonical vertex-stretch
  // SSoT (`StretchEntityCommand`, moving start+end by `delta` — the SAME path the
  // centre midpoint grip uses; a line is a primitive, NOT a BIM params move). Mirrors
  // how the wall's `wallGripKind` branch commits `wall-midpoint` regardless of the
  // active GripMode, so the directional move-by-value always moves (never falls into a
  // rotate/scale/mirror tool-handoff if the user cycled grip mode first).
  if (lineKind === 'line-move') {
    commitDxfGripDragViaStretchCommand(grip, delta, deps);
    return;
  }
  // ADR-357 Phase 12 — copy toggle gates routing for every mode.
  const copyOn = GripCopyModeStore.getSnapshot().enabled;

  if (mode === 'move') {
    // Copy + Move = clone-with-anchor-translation; plain Move = whole-entity
    // translate. Shared with the Alt base-point bypass (single SSoT).
    commitWholeEntityMove(grip, delta, deps, copyOn);
    return;
  }
  if (mode === 'rotate' || mode === 'scale' || mode === 'mirror') {
    // Phase 12 — forward the copy flag through the handoff so the downstream
    // tool starts with its native copyMode / keepOriginals path armed.
    GripHandoffStore.set(mode, grip.position, copyOn ? { copyMode: true } : undefined);
    deps.onToolChange(mode);
    return;
  }
  // mode === 'stretch' (default): unified StretchEntityCommand path
  // (Copy toggle is handled inside `commitDxfGripDragViaStretchCommand`).
  commitDxfGripDragViaStretchCommand(grip, delta, deps);
}
// Overlay commit adapters live in `overlay-grip-commit-adapters.ts`
// (split for N.7.1 file-size compliance — re-exported via grips/index.ts).
