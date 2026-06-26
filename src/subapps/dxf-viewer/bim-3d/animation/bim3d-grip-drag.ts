'use client';

/**
 * bim3d-grip-drag.ts — 3D reshape-grip drag glue for the slab footprint pilot
 * (ADR-535 Φ1 grips + Φ2 live preview / snap).
 *
 * Extracted from `bim3d-edit-interaction-handlers` (file-size N.7.1) so the grip
 * concerns live together: (re)seating the per-vertex grips on the slab top, the
 * per-frame live reshape preview, and the single commit-on-release. The interaction
 * handlers stay the thin dispatcher (grip-first hit-test → these helpers). Pure
 * functions driven by the `EditInteractionCtx` the hook builds once.
 *
 * The `EditInteractionCtx` import is type-only (erased at compile), so there is NO
 * runtime cycle with the handlers module that imports these helpers.
 */

import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo } from '../../hooks/grip-types';
import { computeDxfEntityGrips } from '../../hooks/grip-computation';
import { useBim3DEditStore } from '../stores/Bim3DEditStore';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { reshapeGripsForSlab } from '../grips/grip-3d-reshape-grips';
import { commitGrip3DReshape } from '../grips/grip-3d-commit';
import type { GripElevationMmFor } from '../grips/grip-mesh-factory-3d';
// ADR-535 Φ2 — per-vertex slab-top elevation (slope plane) SSoT + building base resolver.
import { slabTopZmmAt } from '../../bim/geometry/slab-slope';
import { resolveEntityBuilding } from '../../bim/utils/bim-floor-utils';
import { findBimEntityWorldBox } from './bim3d-edit-interaction-helpers';
import { buildSlabReshapePreviewObject } from './bim3d-preview-rebuild';
import { resolveEditEntities } from './bim3d-edit-drag-snap';
import { resolveEntityLevelId } from './bim3d-edit-live-preview-apply';
import type { EditInteractionCtx } from './bim3d-edit-interaction-handlers';

/**
 * ADR-535 Φ1 — (re)compute the 3D reshape grips for a single-select SLAB and push them
 * onto the grip overlay. Cleared for any other selection (multi / non-slab / deselected).
 * Each grip rides its OWN top-surface elevation (`slabTopZmmAt`) so the per-vertex square
 * hugs the slab top — even when the slab is TILTED (a sloped slab's vertices sit at
 * different Y; Φ1's single `box.max.y` made the low corners' grips fly). The grip plan
 * positions reuse the 2D SSoT (`computeDxfEntityGrips`), filtered to footprint reshape
 * grips. Called after `computeEditAnchor` (selection + auto-resync re-anchor).
 */
export function refreshReshapeGrips(
  ctx: EditInteractionCtx,
  entityIds: readonly string[],
  bimType: string | null,
): void {
  if (entityIds.length !== 1 || bimType !== 'slab') {
    ctx.gripOverlay.setGrips([]);
    return;
  }
  const target = resolveEditEntities(ctx).find((t) => t.entityId === entityIds[0]);
  const box = findBimEntityWorldBox(ctx.manager.bimLayer.group, entityIds[0]);
  if (!target || !box) {
    ctx.gripOverlay.setGrips([]);
    return;
  }
  const grips = reshapeGripsForSlab(computeDxfEntityGrips(target.entity as unknown as DxfEntityUnion));
  ctx.gripOverlay.setGrips(grips, slabGripElevationMmFor(entityIds[0], box.max.y));
  ctx.gripOverlay.updateScale(ctx.manager.getCamera());
}

/**
 * ADR-535 Φ2 — per-grip top-surface elevation (mm) for a slab: each footprint vertex /
 * edge-midpoint rides the slab's (possibly TILTED) top plane via the `slabTopZmmAt` SSoT
 * + the building base elevation — so the cubes hug the sloped top, byte-consistent with
 * the rendered mesh (`applySlabSlope` consumes the same `slabSlopeOffsetZmm`). Reads the
 * slab from the SAME store the 3D mesh is built from (`Bim3DEntitiesStore`). Falls back to
 * the world AABB top (`fallbackWorldY`) when the slab is not in the store.
 */
function slabGripElevationMmFor(slabId: string, fallbackWorldY: number): GripElevationMmFor {
  const s = useBim3DEntitiesStore.getState();
  const slab = s.slabs.find((sl) => sl.id === slabId);
  if (!slab) return () => fallbackWorldY * 1000;
  const baseMm = (resolveEntityBuilding(slab, s.floors, s.buildings)?.baseElevation ?? 0) * 1000;
  return (grip) => slabTopZmmAt(slab.params, { x: grip.position.x, y: grip.position.y }) + baseMm;
}

/**
 * ADR-535 Φ2 — rebuild the dragged slab's mesh for THIS frame so the footprint reshapes
 * live (the grip sibling of `applyLivePreview`'s resize path). Reads the in-progress grip
 * + its snapped plan-mm delta from the controller and swaps the fresh `slabToMesh` object
 * in via the live-preview SSoT (`captureResize` ran on pointerdown). A null object (no-op
 * frame / multi-floor) leaves the last preview standing.
 */
export function applyGripReshapePreview(ctx: EditInteractionCtx): void {
  const cur = ctx.gripController.currentDrag();
  if (!cur || !cur.grip.slabGripKind) return;
  ctx.preview.applyResize(
    buildSlabReshapePreviewObject(cur.grip.entityId, cur.grip.slabGripKind, cur.deltaMm),
  );
}

/**
 * ADR-535 — commit a finished grip drag (or no-op). Resolves the slab's level, runs
 * `commitGrip3DReshape` (→ UpdateSlabParamsCommand), then refreshes the grip squares to
 * their canonical positions (post-commit re-sync OR snap-back of the live-followed square
 * when the delta was zero / the commit was rejected). Returns true when a command actually
 * executed (Φ2: the caller then keeps the live preview and lets the re-sync replace the
 * meshes; false → it restores the original slab mesh).
 */
export function commitGripReshape(
  ctx: EditInteractionCtx,
  result: { grip: GripInfo; deltaMm: Point2D } | null,
): boolean {
  let committed = false;
  if (result) {
    const levels = ctx.getLevels();
    const entityId = result.grip.entityId;
    const levelId = levels && entityId ? (resolveEntityLevelId(levels, entityId) ?? levels.currentLevelId) : null;
    if (levels && levelId) committed = commitGrip3DReshape(result.grip, result.deltaMm, levels, levelId) !== null;
  }
  const st = useBim3DEditStore.getState();
  refreshReshapeGrips(ctx, st.editEntityIds, st.editBimType);
  return committed;
}
