'use client';

/**
 * ADR-402 Phase B — drag-time snapping for the 3D BIM gizmo, extracted from
 * `bim3d-edit-interaction-handlers` (file-size N.7.1). Reuses the ONE global snap
 * engine (`getGlobalSnapEngine`) — no new snap logic:
 *   - `buildDragSnapFn` builds the per-drag `SnapFn` (move = characteristic points of
 *     every selected element as plan-mm offsets; resize/endpoint = the one dragged
 *     control point). Returns null (free drag) for rotate / vertical resize / OSNAP-off.
 *   - `syncSnapEngineViewportFor3D` re-derives the engine's pixel tolerance from the 3D
 *     camera so the magnet pull scales with the 3D zoom (1 world metre = 1000 DXF mm).
 *   - `resolveEditEntities` resolves the active edit entities (shared snap-source +
 *     reshape-grip lookup; [0] = primary).
 */

import * as THREE from 'three';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import { isWallEntity, type Entity } from '../../types/entities';
import { computeDxfEntityGrips } from '../../hooks/grip-computation';
import { getGlobalSnapEngine } from '../../snapping/global-snap-engine';
import { worldToDxfPlan, dxfPlanToWorld, getPixelWorldSize, worldToScreen as worldToScreen3D } from '../viewport/coordinate-transforms';
import { makeMoveSnapFn, makeResizeSnapFn, type SnapFn } from '../gizmo/bim3d-snap-bridge';
import { useBim3DEditStore } from '../stores/Bim3DEditStore';
import { getWallCornerWorldPoints } from '../../bim/walls/wall-corner-anchors';
import { resolveEntityLevelId } from './bim3d-edit-live-preview-apply';
import type { EditInteractionCtx } from './bim3d-edit-interaction-handlers';

/**
 * Build the drag snap callback (ADR-402 Phase B). Reuses the ONE snap engine
 * (`getGlobalSnapEngine`) — no new snap logic. Move reuses the element's
 * characteristic points (grips, the 2D SSoT) as plan-mm offsets from the gizmo
 * anchor so ANY corner/endpoint may grab a target (AutoCAD-style); horizontal
 * resize snaps the dragged handle. Returns null (free drag) for rotate, vertical
 * resize, OSNAP-off, or an unresolved target.
 */
export function buildDragSnapFn(ctx: EditInteractionCtx): SnapFn | null {
  const constraint = ctx.controller.getActiveConstraint();
  if (!constraint || constraint.kind === 'rotate') return null;
  if (constraint.kind === 'resize' && constraint.axis === 'y') return null;
  // ADR-402 — vertical (axis-Y) move is a pure elevation drag; plan snapping is moot.
  if (constraint.kind === 'axis' && constraint.axis === 'y') return null;
  const engine = getGlobalSnapEngine();
  if (!engine.getSettings().enabled) return null;
  // ADR-363 Φ1G.5 Slice 2i-fix — the snap engine's pixel→world tolerance comes from its
  // viewport's `worldPerPixelAt`, which is owned by the 2D canvas. In 3D nobody set it →
  // it fell back to ~1 mm/px → tolerance ~10 mm → the wall never "stuck" (Giorgio). Sync a
  // 3D-camera-derived viewport at drag start so the magnet pull scales with the 3D zoom.
  syncSnapEngineViewportFor3D(ctx, engine);
  const targets = resolveEditEntities(ctx);
  if (targets.length === 0) return null;
  // Resize + endpoint are single-entity only (multi-select hides those handles). Both
  // snap the ONE dragged control point to scene features ("Connect To", ADR-408 Φ-D).
  if (constraint.kind === 'resize' || constraint.kind === 'endpoint') {
    return makeResizeSnapFn(engine, targets[0].entityId);
  }
  // move (axis / plane / free): characteristic points of EVERY selected element as
  // plan-mm offsets from the group anchor (ADR-402 Phase C — snap from all, nearest-wins).
  const anchorPlan = worldToDxfPlan(ctx.overlay.getPosition());
  // ADR-408 — a relocated base point snaps THAT single point (Revit Move base→dest),
  // not all grips. The gizmo anchor IS the override, so the offset is ~0; computing it
  // explicitly stays robust if the two ever diverge.
  const override = useBim3DEditStore.getState().basePointOverride;
  if (override) {
    const op = worldToDxfPlan(new THREE.Vector3(override.x, override.y, override.z));
    const offset = { x: op.x - anchorPlan.x, y: op.y - anchorPlan.y };
    return makeMoveSnapFn(engine, [offset], targets[0].entityId);
  }
  const offsets = targets.flatMap((t) =>
    computeDxfEntityGrips(t.entity as unknown as DxfEntityUnion).map((g) => ({
      x: g.position.x - anchorPlan.x,
      y: g.position.y - anchorPlan.y,
    })),
  );
  // ADR-363 Φ1G.5 Slice 2i — also probe with the dragged wall's FACE corners so a face
  // (not just an axis grip) can grab a static wall's face line → flush face-to-face
  // magnetism (Revit). The grips alone only snapped axis points (corners/endpoints).
  const faceOffsets = targets.flatMap((t) =>
    isWallEntity(t.entity)
      ? getWallCornerWorldPoints(t.entity).map((c) => ({ x: c.point.x - anchorPlan.x, y: c.point.y - anchorPlan.y }))
      : [],
  );
  return makeMoveSnapFn(engine, [...offsets, ...faceOffsets], targets[0].entityId);
}

/**
 * ADR-363 Φ1G.5 Slice 2i-fix — give the shared snap engine a 3D-derived viewport so its
 * pixel tolerance (`worldRadiusForType = px × worldPerPixel`) scales with the 3D camera zoom
 * instead of the stale 2D value (the root cause of "δεν κολλάει"). 1 Three world metre =
 * 1000 DXF-plan mm. Self-healing: the 2D snap path re-sets the viewport on its next mouse move.
 */
function syncSnapEngineViewportFor3D(ctx: EditInteractionCtx, engine: ReturnType<typeof getGlobalSnapEngine>): void {
  const camera = ctx.manager.getCamera();
  const canvas = ctx.manager.getRendererCanvas();
  const anchorWorld = ctx.overlay.getPosition();
  const dist = camera.position.distanceTo(anchorWorld);
  const mmPerPx = getPixelWorldSize(dist, camera, canvas) * 1000; // metres/px → DXF mm/px
  if (!(mmPerPx > 0)) return;
  const elevMm = worldToDxfPlan(anchorWorld).z;
  engine.setViewport({
    scale: 1 / mmPerPx,
    worldPerPixelAt: () => mmPerPx,
    worldToScreen: (p) => worldToScreen3D(dxfPlanToWorld(p.x, p.y, elevMm), camera, canvas) ?? { x: 0, y: 0 },
  });
}

/**
 * Resolve every active edit entity + id (snap-source grips / self-exclusion).
 * Single-element selection returns one; multi-select returns all. [0] = primary.
 */
export function resolveEditEntities(ctx: EditInteractionCtx): { entity: Entity; entityId: string }[] {
  const levels = ctx.getLevels();
  const ids = useBim3DEditStore.getState().editEntityIds;
  if (!levels || ids.length === 0) return [];
  const out: { entity: Entity; entityId: string }[] = [];
  for (const entityId of ids) {
    const levelId = resolveEntityLevelId(levels, entityId) ?? levels.currentLevelId;
    if (!levelId) continue;
    const entity = levels.getLevelScene(levelId)?.entities?.find((en) => en.id === entityId);
    if (entity) out.push({ entity, entityId });
  }
  return out;
}
