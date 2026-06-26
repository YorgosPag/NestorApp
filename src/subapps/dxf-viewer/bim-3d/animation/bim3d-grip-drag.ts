'use client';

/**
 * bim3d-grip-drag.ts — 3D reshape-grip drag glue for footprint entities
 * (ADR-535 Φ1 grips + Φ2 live preview / snap + Φ3a slab / roof / floor-finish).
 *
 * Extracted from `bim3d-edit-interaction-handlers` (file-size N.7.1) so the grip
 * concerns live together: (re)seating the per-vertex grips on each type's top surface,
 * the per-frame live reshape preview, and the single commit-on-release. The interaction
 * handlers stay the thin dispatcher (grip-first hit-test → these helpers). Pure
 * functions driven by the `EditInteractionCtx` the hook builds once.
 *
 * The `EditInteractionCtx` import is type-only (erased at compile), so there is NO
 * runtime cycle with the handlers module that imports these helpers.
 */

import type * as THREE from 'three';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo } from '../../hooks/grip-types';
import { computeDxfEntityGrips } from '../../hooks/grip-computation';
import { useBim3DEditStore } from '../stores/Bim3DEditStore';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { reshapeGripsForFootprint } from '../grips/grip-3d-reshape-grips';
import { commitGrip3DReshape } from '../grips/grip-3d-commit';
import type { GripElevationMmFor } from '../grips/grip-mesh-factory-3d';
// ADR-535 Φ2/Φ3 — per-vertex top-surface elevation SSoT + building base resolver.
// slab → slope plane (`slabTopZmmAt`); roof → lower-envelope (`roofZmm`).
import { slabTopZmmAt } from '../../bim/geometry/slab-slope';
import { resolveEavePlanes, roofZmm } from '../../bim/geometry/roof-lower-envelope';
import { mmToSceneUnits } from '../../utils/scene-units';
import { resolveEntityBuilding } from '../../bim/utils/bim-floor-utils';
import { findBimEntityWorldBox } from './bim3d-edit-interaction-helpers';
import {
  buildSlabReshapePreviewObject,
  buildRoofReshapePreviewObject,
  buildFloorFinishReshapePreviewObject,
  buildSlabOpeningReshapePreviewObject,
} from './bim3d-grip-preview-builders';
import { resolveEditEntities } from './bim3d-edit-drag-snap';
import { resolveEntityLevelId } from './bim3d-edit-live-preview-apply';
import type { EditInteractionCtx } from './bim3d-edit-interaction-handlers';

/** BIM types that expose a per-vertex footprint reshape sketch in 3D (ADR-535 Φ3a/Φ3b). */
const RESHAPE_BIM_TYPES: ReadonlySet<string> = new Set(['slab', 'roof', 'floor-finish', 'slab-opening']);

/**
 * ADR-535 Φ1/Φ3 — (re)compute the 3D reshape grips for a single-select footprint entity
 * (slab / roof / floor-finish) and push them onto the grip overlay. Cleared for any other
 * selection (multi / unsupported type / deselected). Each grip rides its OWN top-surface
 * elevation (per `bimType`) so the per-vertex square hugs the surface — even when it is
 * TILTED / sloped (Φ1's single `box.max.y` made the low corners' grips fly). The grip plan
 * positions reuse the 2D SSoT (`computeDxfEntityGrips`), filtered to footprint reshape
 * grips. Called after `computeEditAnchor` (selection + auto-resync re-anchor).
 */
export function refreshReshapeGrips(
  ctx: EditInteractionCtx,
  entityIds: readonly string[],
  bimType: string | null,
): void {
  if (entityIds.length !== 1 || !bimType || !RESHAPE_BIM_TYPES.has(bimType)) {
    ctx.gripOverlay.setGrips([]);
    return;
  }
  const target = resolveEditEntities(ctx).find((t) => t.entityId === entityIds[0]);
  const box = findBimEntityWorldBox(ctx.manager.bimLayer.group, entityIds[0]);
  if (!target || !box) {
    ctx.gripOverlay.setGrips([]);
    return;
  }
  const grips = reshapeGripsForFootprint(computeDxfEntityGrips(target.entity as unknown as DxfEntityUnion));
  ctx.gripOverlay.setGrips(grips, gripElevationMmFor(bimType, entityIds[0], box.max.y));
  ctx.gripOverlay.updateScale(ctx.manager.getCamera());
}

/**
 * ADR-535 Φ3 — per-bimType top-surface elevation resolver for the grip cubes. slab + roof
 * ride a per-vertex surface (slope / lower-envelope); floor-finish is a flat FFL plane so
 * the world AABB top (`fallbackWorldY`) is already exact (zero extra computation).
 */
function gripElevationMmFor(bimType: string, entityId: string, fallbackWorldY: number): GripElevationMmFor {
  if (bimType === 'slab') return slabGripElevationMmFor(entityId, fallbackWorldY);
  if (bimType === 'roof') return roofGripElevationMmFor(entityId, fallbackWorldY);
  // ADR-535 Φ3b — an opening's grips ride its HOST SLAB top (the opening has no own Z).
  if (bimType === 'slab-opening') return slabOpeningGripElevationMmFor(entityId, fallbackWorldY);
  return () => fallbackWorldY * 1000; // floor-finish: flat top (FFL plane).
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
 * ADR-535 Φ3 — per-grip top-surface elevation (mm) for a roof: each footprint vertex /
 * edge-midpoint rides the roof's lower-envelope top plane via the `roofZmm` SSoT (the SAME
 * height field `computeRoofGeometry` lifts the faces with → grip === rendered surface) +
 * the building base. Perimeter vertices land at `basePivotZ` (the eaves datum); a midpoint
 * on a sloped/gable edge rises with the roof. Falls back to the world AABB top (the ridge)
 * only when the roof is absent from the store.
 */
function roofGripElevationMmFor(roofId: string, fallbackWorldY: number): GripElevationMmFor {
  const s = useBim3DEntitiesStore.getState();
  const roof = s.roofs.find((r) => r.id === roofId);
  if (!roof) return () => fallbackWorldY * 1000;
  const baseMm = (resolveEntityBuilding(roof, s.floors, s.buildings)?.baseElevation ?? 0) * 1000;
  const verts = roof.params.outline.vertices;
  const scaleS = mmToSceneUnits(roof.params.sceneUnits ?? 'mm');
  const { planes } = resolveEavePlanes(verts, roof.params.edges, roof.params.slopeUnit);
  return (grip) => roofZmm(planes, roof.params.basePivotZ, scaleS, { x: grip.position.x, y: grip.position.y }) + baseMm;
}

/**
 * ADR-535 Φ3b — per-grip top-surface elevation (mm) for a slab OPENING: each
 * opening-outline vertex / edge-midpoint rides the HOST SLAB's (possibly TILTED) top
 * plane via the SAME `slabTopZmmAt` SSoT the slab grips use + the building base. The
 * opening carries no Z of its own, so it borrows the host slab's surface — the grips
 * sit exactly on the slab top around the hole. Falls back to the world AABB top (the
 * opening's pick-mesh top) when the opening or its host slab is absent from the store.
 */
function slabOpeningGripElevationMmFor(openingId: string, fallbackWorldY: number): GripElevationMmFor {
  const slab = resolveSlabOpeningHostSlab(openingId);
  if (!slab) return () => fallbackWorldY * 1000;
  const s = useBim3DEntitiesStore.getState();
  const baseMm = (resolveEntityBuilding(slab, s.floors, s.buildings)?.baseElevation ?? 0) * 1000;
  return (grip) => slabTopZmmAt(slab.params, { x: grip.position.x, y: grip.position.y }) + baseMm;
}

/** Resolve the host SlabEntity for a slab-opening id (null when either is missing). */
function resolveSlabOpeningHostSlab(openingId: string) {
  const s = useBim3DEntitiesStore.getState();
  const opening = s.slabOpenings.find((o) => o.id === openingId);
  if (!opening) return null;
  return s.slabs.find((sl) => sl.id === opening.params.slabId) ?? null;
}

/**
 * ADR-535 Φ3b — the id of the slab that hosts `openingId`, or null. The 3D reshape
 * of a slab-opening rebuilds its host slab mesh (the opening is a void), so the
 * pointerdown handler must capture the HOST SLAB — not the opening — for the live
 * per-frame preview swap (§2.3). The snap fn keeps the opening id for self-exclusion.
 */
export function resolveSlabOpeningHostSlabId(openingId: string): string | null {
  return resolveSlabOpeningHostSlab(openingId)?.id ?? null;
}

/**
 * ADR-535 Φ2/Φ3 — rebuild the dragged entity's mesh for THIS frame so its footprint
 * reshapes live (the grip sibling of `applyLivePreview`'s resize path). Reads the
 * in-progress grip + its snapped plan-mm delta from the controller, dispatches to the
 * per-type preview builder by the grip's discriminator, and swaps the fresh converter
 * object in via the live-preview SSoT (`captureResize` ran on pointerdown). A null object
 * (no-op frame / multi-floor / unknown grip) leaves the last preview standing.
 */
export function applyGripReshapePreview(ctx: EditInteractionCtx): void {
  const cur = ctx.gripController.currentDrag();
  if (!cur) return;
  ctx.preview.applyResize(buildGripReshapePreview(cur.grip, cur.deltaMm));
}

/** Dispatch a reshape-grip drag to its per-type live preview builder (ghost === commit). */
function buildGripReshapePreview(grip: GripInfo, deltaMm: Point2D): THREE.Object3D | null {
  if (grip.slabGripKind) return buildSlabReshapePreviewObject(grip.entityId, grip.slabGripKind, deltaMm);
  if (grip.roofGripKind) return buildRoofReshapePreviewObject(grip.entityId, grip.roofGripKind, deltaMm);
  if (grip.floorFinishGripKind) {
    return buildFloorFinishReshapePreviewObject(grip.entityId, grip.floorFinishGripKind, deltaMm);
  }
  // ADR-535 Φ3b — slab-opening: rebuild the HOST SLAB with the moved hole (entityId = opening id).
  if (grip.slabOpeningGripKind) {
    return buildSlabOpeningReshapePreviewObject(grip.entityId, grip.slabOpeningGripKind, deltaMm);
  }
  return null;
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
