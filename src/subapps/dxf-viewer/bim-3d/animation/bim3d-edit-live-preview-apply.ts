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

import type { Entity } from '../../types/entities';
import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import { useBim3DEditStore } from '../stores/Bim3DEditStore';
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
} from './bim3d-pipe-follow-preview-rebuild';
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
    if (ctx.preview.connectedPipeSegmentIds.length > 0) {
      ctx.preview.applyPipes(
        buildPipeFollowPreviewObjects(
          new Set(useBim3DEditStore.getState().editEntityIds),
          { kind: 'endpoint', endpoint: live.endpoint, deltaMm: live.outcome.deltaMm, deltaUpMm: live.outcome.deltaUpMm },
          sceneEntitiesForEdit(ctx),
        ),
      );
    }
    // ADR-408 Φ-D/Φ-E — the cap (and any elbow/tee) at the dragged end follows live.
    if (ctx.preview.incidentFittingIds.length > 0) {
      ctx.preview.applyFittings(
        buildFittingFollowPreviewObjects(
          new Set(useBim3DEditStore.getState().editEntityIds),
          { kind: 'endpoint', endpoint: live.endpoint, deltaMm: live.outcome.deltaMm, deltaUpMm: live.outcome.deltaUpMm },
          sceneEntitiesForEdit(ctx),
        ),
      );
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
