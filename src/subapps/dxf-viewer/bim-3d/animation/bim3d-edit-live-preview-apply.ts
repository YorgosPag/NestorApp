'use client';

/**
 * ADR-402 (3D Viewport BIM Element Editing) — live-preview application for the
 * GenArc-port BIM gizmo (Phase A).
 *
 * Extracted from `bim3d-edit-interaction-handlers.ts` (file-size N.7.1) so the
 * pointer-handler module stays focused on the event flow and the per-frame
 * "entity follows the cursor" rebuild lives in its own unit. `applyLivePreview`
 * runs every changed pointermove frame; `sceneEntitiesForEdit` /
 * `resolveEntityLevelId` are the shared scene-lookup leaves used both here and by
 * the capture helpers in the handler module.
 *
 * The handler module imports these at runtime; this module imports only the
 * `EditInteractionCtx` TYPE from there (type-only → no runtime cycle).
 */

import * as THREE from 'three';
import type { Entity } from '../../types/entities';
import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import { useBim3DEditStore } from '../stores/Bim3DEditStore';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import {
  buildResizePreviewObject,
  buildTiltPreviewObject,
  buildEndpointMovePreviewObject,
  buildDependentWallPreviewObject,
} from './bim3d-preview-rebuild';
// ADR-408 Φ7 P2 — host move → live circuit-wire re-route (mirror of the ADR-401 wall path).
import { buildCircuitWirePreviewObjects } from './bim3d-wire-preview-rebuild';
// ADR-408 Φ-C — host/pipe move/rotate/vertical → live connected-pipe stretch.
// ADR-408 Φ-D/Φ-E — + live fitting (cap/elbow/tee) follow at moved junctions.
import {
  buildPipeFollowPreviewObjects,
  buildFittingFollowPreviewObjects,
  type PipeDragXform,
} from './bim3d-pipe-follow-preview-rebuild';
// ADR-535 Φ10 / ADR-516 — keep the per-vertex reshape grips glued to the entity during a move.
import { setGrip3DLiveMoveWorld } from '../stores/Grip3DOverlayStore';
import type { EditInteractionCtx } from './bim3d-edit-interaction-handlers';

/** The full entity list of the edited entities' floor (for the connected-pipe resolver). */
export function sceneEntitiesForEdit(ctx: EditInteractionCtx): readonly Entity[] {
  const levels = ctx.getLevels();
  const ids = useBim3DEditStore.getState().editEntityIds;
  if (!levels || ids.length === 0) return [];
  const levelId = resolveEntityLevelId(levels, ids[0]) ?? levels.currentLevelId;
  if (!levelId) return [];
  return levels.getLevelScene(levelId)?.entities ?? [];
}

/** Which level's scene contains `entityId` (multi-floor edge case). */
export function resolveEntityLevelId(levels: LevelsHookReturn, entityId: string): string | null {
  for (const lvl of levels.levels) {
    const scene = levels.getLevelScene(lvl.id);
    if (scene?.entities?.some((e) => e.id === entityId)) return lvl.id;
  }
  return null;
}

/**
 * Drive the live "entity follows the cursor" preview from the controller's live
 * drag snapshot (ADR-402): rigid mesh transform for move/rotate, per-frame geometry
 * rebuild (converter SSoT) for resize. Runs every changed pointermove frame.
 */
export function applyLivePreview(ctx: EditInteractionCtx): void {
  const live = ctx.controller.getLivePreview();
  if (!live) return;
  if (live.kind === 'move') {
    // Mirror the command's keyboard axis lock so the preview matches the commit:
    // 'X' keeps world-X (DXF x) → drop world-Z; 'Z' keeps world-Z (DXF y) → drop
    // world-X. The vertical (world-Y) component is untouched (axis-Y elevation move).
    const lock = useBim3DEditStore.getState().axisLock;
    const t = live.translation.clone();
    if (lock === 'X') t.z = 0;
    else if (lock === 'Z') t.x = 0;
    ctx.preview.applyMove(t);
    // ADR-535 Φ10 / ADR-516 — shift the per-vertex reshape grips by the SAME locked world
    // translation the mesh just got, so the squares stay glued to the moving entity (rigid
    // handle-follow, ghost === grips). Cleared on drag settle; re-seated by the commit re-sync.
    setGrip3DLiveMoveWorld({ x: t.x, y: t.y, z: t.z });
    // ADR-401 — re-clip the captured attached walls with the hosts at the preview
    // position (host footprint shifted by `t`). Same converter SSoT as the commit
    // re-sync (ghost === commit). No dependents → the array is empty (fast path).
    const depWallIds = ctx.preview.dependentWallIds;
    if (depWallIds.length > 0) {
      const hostIds = ctx.preview.movedHostIds;
      ctx.preview.applyDependents(
        depWallIds.map((wid) => buildDependentWallPreviewObject(wid, hostIds, t)),
      );
    }
    // ADR-408 Φ7 P2 — re-route the captured circuit conduits with the dragged
    // fixtures/panels at the preview position (`t`). Same routing + converter SSoT
    // as the commit re-sync (ghost === commit). No wired host → array is empty.
    if (ctx.preview.circuitWireSystemIds.length > 0) {
      const draggedIds = new Set(useBim3DEditStore.getState().editEntityIds);
      ctx.preview.applyWires(buildCircuitWirePreviewObjects(draggedIds, { kind: 'move', translation: t }));
    }
    // ADR-408 Φ-C — stretch the captured connected pipes with the dragged MEP entity
    // at the preview position (`t` carries plan + vertical). Same resolver SSoT as commit.
    if (ctx.preview.connectedPipeSegmentIds.length > 0) {
      ctx.preview.applyPipes(
        buildPipeFollowPreviewObjects(
          new Set(useBim3DEditStore.getState().editEntityIds),
          { kind: 'move', translation: t },
          sceneEntitiesForEdit(ctx),
        ),
      );
    }
    // ADR-408 Φ-D/Φ-E — caps/elbows/tees at moved junctions follow live.
    if (ctx.preview.incidentFittingIds.length > 0) {
      ctx.preview.applyFittings(
        buildFittingFollowPreviewObjects(
          new Set(useBim3DEditStore.getState().editEntityIds),
          { kind: 'move', translation: t },
          sceneEntitiesForEdit(ctx),
        ),
      );
    }
    // ADR-363 Φ1G.5 Slice 2h — a single dragged WALL shows Revit temporary dimensions:
    // its perpendicular clearance to the nearest parallel reference wall on each side.
    updateWallMoveDims(ctx, t);
    // ADR-363 Φ1G.5 Slice 2i — a dashed alignment line along the reference face when a
    // face snap is active (the "feel" of the magnetism), driven by the live snap result.
    updateAlignmentLine(ctx);
    // Giorgio 2026-07-22 — ο snap-type label («Κάθετος» κ.λπ.) + το live move-distance
    // readout («130,15 cm») ΔΕΝ εμφανίζονται πλέον στο 3D edit drag (οπτικός θόρυβος). Το
    // snapping/η ευθυγράμμιση παραμένουν ενεργά· κρύβουμε μόνο το κειμενικό feedback. Τα
    // overlays ξεκινούν κρυμμένα + το teardown τα κάνει hide → μηδέν residual.
    return;
  }
  if (live.kind === 'rotate') {
    ctx.preview.applyRotate(live.pivot, live.angleRad);
    // ADR-408 Φ7 P2b — re-route the captured conduits with the dragged hosts orbited
    // about the gizmo pivot (world +Y ↔ DXF-plan CCW, 1:1). Same routing SSoT as move.
    if (ctx.preview.circuitWireSystemIds.length > 0) {
      const draggedIds = new Set(useBim3DEditStore.getState().editEntityIds);
      ctx.preview.applyWires(
        buildCircuitWirePreviewObjects(draggedIds, { kind: 'rotate', pivot: live.pivot, angleRad: live.angleRad }),
      );
    }
    // ADR-408 Φ-C — stretch the captured connected pipes as the dragged MEP entity orbits.
    if (ctx.preview.connectedPipeSegmentIds.length > 0) {
      ctx.preview.applyPipes(
        buildPipeFollowPreviewObjects(
          new Set(useBim3DEditStore.getState().editEntityIds),
          { kind: 'rotate', pivot: live.pivot, angleRad: live.angleRad },
          sceneEntitiesForEdit(ctx),
        ),
      );
    }
    // ADR-408 Φ-D/Φ-E — caps/elbows/tees at moved junctions follow the rotation live.
    if (ctx.preview.incidentFittingIds.length > 0) {
      ctx.preview.applyFittings(
        buildFittingFollowPreviewObjects(
          new Set(useBim3DEditStore.getState().editEntityIds),
          { kind: 'rotate', pivot: live.pivot, angleRad: live.angleRad },
          sceneEntitiesForEdit(ctx),
        ),
      );
    }
    return;
  }
  if (live.kind === 'endpoint-move') {
    // ADR-408 Φ-D — rebuild the dragged segment via the converter SSoT (node move),
    // swapped in through the same hide-and-replace path as resize; its connected pipes
    // STRETCH live via the same resolver SSoT as the commit (ghost === commit).
    const epId = useBim3DEditStore.getState().editEntityIds[0];
    if (!epId) return;
    ctx.preview.applyResize(
      buildEndpointMovePreviewObject(epId, live.endpoint, live.outcome.deltaMm, live.outcome.deltaUpMm),
    );
    // Pipes + fittings both follow the moved endpoint under the SAME xform/scene (ADR-408 Φ-D/Φ-E).
    const epDraggedIds = new Set(useBim3DEditStore.getState().editEntityIds);
    const epXform: PipeDragXform = {
      kind: 'endpoint',
      endpoint: live.endpoint,
      deltaMm: live.outcome.deltaMm,
      deltaUpMm: live.outcome.deltaUpMm,
    };
    const epScene = sceneEntitiesForEdit(ctx);
    if (ctx.preview.connectedPipeSegmentIds.length > 0) {
      ctx.preview.applyPipes(buildPipeFollowPreviewObjects(epDraggedIds, epXform, epScene));
    }
    if (ctx.preview.incidentFittingIds.length > 0) {
      ctx.preview.applyFittings(buildFittingFollowPreviewObjects(epDraggedIds, epXform, epScene));
    }
    return;
  }
  if (live.kind === 'tilt') {
    // ADR-404 — tilt rebuilds the single entity via the converter SSoT (shear),
    // swapped in through the same hide-and-replace path as resize. Skip a roll ring
    // (X/Z axis = no-op for the type) → `buildTiltPreviewObject` returns null.
    if (live.axis === 'y') return; // defensive: Y ring is plan rotate, not tilt
    const tiltId = useBim3DEditStore.getState().editEntityIds[0];
    if (!tiltId) return;
    ctx.preview.applyResize(buildTiltPreviewObject(tiltId, { axis: live.axis, angleDeg: live.angleDeg }));
    return;
  }
  // resize — rebuild the single dragged entity's geometry via the converter SSoT.
  const id = useBim3DEditStore.getState().editEntityIds[0];
  if (!id) return;
  ctx.preview.applyResize(
    buildResizePreviewObject(id, {
      axis: live.outcome.axis,
      mode: live.outcome.mode,
      deltaMm: live.outcome.deltaMm,
      deltaUpMm: live.outcome.deltaUpMm,
      cursorMm: live.outcome.cursorMm,
    }),
  );
}

/**
 * ADR-363 Φ1G.5 Slice 2h — drive the transient wall-move temp dimensions. Only a SINGLE
 * wall selection qualifies (the gizmo move of one wall); any other selection hides the
 * overlay. The dragged wall's live position = its stored axis + the gizmo translation `t`
 * (the overlay applies it); the elevation is the gizmo-anchor height (wall mid-height).
 */
function updateWallMoveDims(ctx: EditInteractionCtx, t: THREE.Vector3): void {
  const edit = useBim3DEditStore.getState();
  if (edit.editEntityIds.length !== 1 || edit.editBimType !== 'wall') {
    ctx.wallMoveDim.hide();
    return;
  }
  const walls = useBim3DEntitiesStore.getState().walls;
  const wall = walls.find((w) => w.id === edit.editEntityIds[0]);
  if (!wall) {
    ctx.wallMoveDim.hide();
    return;
  }
  const worldY = ctx.overlay.getPosition().y;
  ctx.wallMoveDim.update(wall, walls, { x: t.x, y: t.y, z: t.z }, worldY, ctx.manager.getCamera(), ctx.manager.getRendererCanvas());
}

/**
 * ADR-363 Φ1G.5 Slice 2i — draw / hide the Revit dashed alignment line along the wall
 * face the active snap projected onto. The reference comes from the ONE snap engine
 * (`WallFaceSnapEngine` → bridge `alignmentRef`); this only renders it. No active face
 * snap → hide (a corner/endpoint/free drag shows no line, matching Revit).
 */
function updateAlignmentLine(ctx: EditInteractionCtx): void {
  const ref = ctx.controller.getActiveAlignmentWorld();
  if (!ref) {
    ctx.alignmentLine.hide();
    return;
  }
  ctx.alignmentLine.update(ref.a, ref.b);
}
