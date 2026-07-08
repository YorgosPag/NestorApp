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
import { gripKindOf } from '../../hooks/grip-kinds';
import { computeDxfEntityGrips } from '../../hooks/grip-computation';
import { useBim3DEditStore } from '../stores/Bim3DEditStore';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import type { SlabEntity } from '../../bim/types/slab-types';
import { reshapeGripsForFootprint } from '../grips/grip-3d-reshape-grips';
import { commitGrip3DReshape } from '../grips/grip-3d-commit';
import type { PlanElevationMmFor, GripWorldOffset } from '../grips/grip-3d-screen-project';
import { useGrip3DOverlayStore } from '../stores/Grip3DOverlayStore';
// ADR-559 — AutoCAD GRIPOBJLIMIT (selection-count grip suppression), read at event time.
import { gripStyleStore } from '../../stores/GripStyleStore';
import { isGripObjLimitExceeded } from '../../hooks/grips/grip-obj-limit';
// ADR-535 Φ2/Φ3 — per-vertex top-surface elevation SSoT + building base resolver.
// slab → slope plane (`slabTopZmmAt`); roof → lower-envelope (`roofZmm`).
import { slabTopZmmAt, slabUndersideZmmAt } from '../../bim/geometry/slab-slope';
import { resolveEavePlanes, roofZmm } from '../../bim/geometry/roof-lower-envelope';
// ADR-535 Φ11 — battered-wall TOP face is plan-sheared (base stays); the top grips ride it.
import { isWallTilted, wallTiltShearAt } from '../../bim/geometry/wall-tilt';
import { dxfPlanToWorld } from '../viewport/coordinate-transforms';
import { mmToSceneUnits } from '../../utils/scene-units';
import { resolveEntityBuilding } from '../../bim/utils/bim-floor-utils';
import { findBimEntityWorldBox } from './bim3d-edit-interaction-helpers';
import {
  buildSlabReshapePreviewObject,
  buildRoofReshapePreviewObject,
  buildFloorFinishReshapePreviewObject,
  buildSlabOpeningReshapePreviewObject,
  buildColumnReshapePreviewObject,
  buildWallReshapePreviewObject,
  buildBeamReshapePreviewObject,
} from './bim3d-grip-preview-builders';
import { resolveEditEntities } from './bim3d-edit-drag-snap';
import { resolveEntityLevelId } from './bim3d-edit-live-preview-apply';
import type { EditInteractionCtx } from './bim3d-edit-interaction-handlers';

/**
 * BIM types that expose a per-vertex footprint / cross-section reshape sketch in 3D
 * (ADR-535 Φ3a/Φ3b footprints + Φ7 `column` + Φ8 `wall` + Φ9 `beam` cross-section).
 */
const RESHAPE_BIM_TYPES: ReadonlySet<string> = new Set([
  'slab', 'roof', 'floor-finish', 'slab-opening', 'column', 'wall', 'beam',
]);

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
    useGrip3DOverlayStore.getState().clear();
    return;
  }
  // ADR-559 — AutoCAD GRIPOBJLIMIT parity: suppress grips above the selection-object limit.
  // BIM footprint reshape is single-select today (guard above), so this only bites when the
  // limit is set absurdly low; kept for parity + future multi-reshape. Shared rule SSoT.
  if (isGripObjLimitExceeded(entityIds.length, gripStyleStore.get().gripObjLimit)) {
    useGrip3DOverlayStore.getState().clear();
    return;
  }
  const target = resolveEditEntities(ctx).find((t) => t.entityId === entityIds[0]);
  const box = findBimEntityWorldBox(ctx.manager.bimLayer.group, entityIds[0]);
  if (!target || !box) {
    useGrip3DOverlayStore.getState().clear();
    return;
  }
  const grips = reshapeGripsForFootprint(computeDxfEntityGrips(target.entity as unknown as DxfEntityUnion));
  // ADR-535 Φ5/Φ6 — push the grips + per-vertex TOP & BOTTOM elevation to the overlay store;
  // the Canvas2D overlay RAF projects + paints the twin (top+bottom) squares every frame.
  const elevs = gripSurfaceElevationsFor(bimType, entityIds[0], box);
  useGrip3DOverlayStore.getState().setGrips(grips, elevs.top, elevs.bottom, elevs.topWorldShift ?? null);
}

/** ADR-535 Φ6 — the two surface elevation resolvers of a footprint grip (twin top + bottom). */
interface GripSurfaceElevations {
  readonly top: PlanElevationMmFor;
  readonly bottom: PlanElevationMmFor;
  /**
   * ADR-535 Φ11 — a constant WORLD plan-shift applied to the TOP grips only (the BOTTOM/base
   * footprint stays put). Non-null only for a battered (tilted) wall, whose top face is sheared
   * ⟂ to the run by `height·tan(angle)` — so the top squares hug the leaned top edge instead of
   * flying off above the base. Absent ⇒ flat-top member (top sits straight above the base).
   */
  readonly topWorldShift?: GripWorldOffset;
}

/** Degenerate twin (top === bottom) used when the entity is absent from the store. */
function flatSurfaceElevations(fallbackWorldY: number): GripSurfaceElevations {
  const topMm = fallbackWorldY * 1000;
  return { top: () => topMm, bottom: () => topMm };
}

/**
 * ADR-535 Φ3/Φ6 — per-bimType TOP & BOTTOM surface elevation resolvers for the grip squares.
 * slab + roof ride a per-vertex top surface (slope / lower-envelope) with the bottom a constant
 * thickness below; floor-finish is a flat FFL plane minus its finish thickness.
 */
function gripSurfaceElevationsFor(
  bimType: string,
  entityId: string,
  box: THREE.Box3,
): GripSurfaceElevations {
  const fallbackWorldY = box.max.y;
  if (bimType === 'slab') return slabGripSurfaceElevations(entityId, fallbackWorldY);
  if (bimType === 'roof') return roofGripSurfaceElevations(entityId, fallbackWorldY);
  // ADR-535 Φ3b — an opening's grips ride its HOST SLAB top & underside (the opening has no own Z).
  if (bimType === 'slab-opening') return slabOpeningGripSurfaceElevations(entityId, fallbackWorldY);
  // ADR-535 Φ11 — a WALL adds the battered-top plan-shear on top of the flat AABB faces (its
  // top edge leans ⟂ to the run; the base stays). Flat-top common case → no shift (fast path).
  if (bimType === 'wall') return wallGripSurfaceElevations(entityId, box);
  // ADR-535 Φ7/Φ9 — a column's / beam's grips ride its flat top & bottom faces, taken straight
  // from the rendered mesh AABB (byte-consistent with the mesh, zero drift, no extra Z math).
  // The squares of every plan vertex/edge sit at the SAME top (max.y) and bottom (min.y) — correct
  // for the flat-top case. A tilted column/beam top-shear is a flagged follow-up (mirror the wall).
  if (bimType === 'column' || bimType === 'beam') return bboxSurfaceElevations(box);
  return floorFinishGripSurfaceElevations(entityId, fallbackWorldY);
}

/**
 * ADR-535 Φ7/Φ8 — TOP & BOTTOM grip elevation (mm) for a flat-top extruded member (column /
 * wall) = its rendered mesh AABB faces. One SSoT for every member whose grips hug the mesh
 * top/bottom directly (N.0.2 boy-scout: was `columnGripSurfaceElevations`, generalised for wall).
 */
function bboxSurfaceElevations(box: THREE.Box3): GripSurfaceElevations {
  const topMm = box.max.y * 1000;
  const bottomMm = box.min.y * 1000;
  return { top: () => topMm, bottom: () => bottomMm };
}

/**
 * ADR-535 Φ11 — TOP & BOTTOM grip surfaces for a WALL. The flat AABB elevations (mm) are the
 * base; for a BATTERED wall the TOP face is plan-sheared ⟂ to the run by `height·tan(angle)`
 * (the `wallTiltShearAt` SSoT, the SAME shear the 3D mesh + 2D cut use, ADR-404). That shear is
 * a constant plan delta in mm → converted to a WORLD offset via `dxfPlanToWorld` and applied to
 * the top squares only, so they hug the leaned top edge. Vertical wall ⇒ no shift (flat path).
 */
function wallGripSurfaceElevations(wallId: string, box: THREE.Box3): GripSurfaceElevations {
  const flat = bboxSurfaceElevations(box);
  const wall = useBim3DEntitiesStore.getState().walls.find((w) => w.id === wallId);
  if (!wall || !isWallTilted(wall.params)) return flat;
  const shearMm = wallTiltShearAt(wall.params, wall.params.height);
  // Plan-mm delta → world offset (plan x→world x, plan y→world −z, mm→m); elevation handled by `top`.
  const w = dxfPlanToWorld(shearMm.dx, shearMm.dy, 0);
  return { ...flat, topWorldShift: { x: w.x, y: 0, z: w.z } };
}

/**
 * ADR-535 Φ2/Φ6 — TOP & BOTTOM surface elevation (mm) for a slab: each footprint vertex /
 * edge-midpoint rides the slab's (possibly TILTED) top plane via the `slabTopZmmAt` SSoT and
 * its parallel underside via the `slabUndersideZmmAt` SSoT (= top − thickness), plus the
 * building base — so the squares hug the sloped faces, byte-consistent with the rendered mesh.
 * Reads the slab from the SAME store the 3D mesh is built from (`Bim3DEntitiesStore`).
 */
function slabGripSurfaceElevations(slabId: string, fallbackWorldY: number): GripSurfaceElevations {
  const s = useBim3DEntitiesStore.getState();
  const slab = s.slabs.find((sl) => sl.id === slabId);
  if (!slab) return flatSurfaceElevations(fallbackWorldY);
  const baseMm = (resolveEntityBuilding(slab, s.floors, s.buildings)?.baseElevation ?? 0) * 1000;
  return slabTopBottomElevations(slab, baseMm);
}

/**
 * TOP & BOTTOM surface elevation functions riding a slab's (possibly tilted) top plane via the
 * `slabTopZmmAt` SSoT and its parallel underside via `slabUndersideZmmAt`, offset by the building
 * base. Shared by slab grips and slab-opening grips (openings ride their host slab's faces).
 */
function slabTopBottomElevations(slab: SlabEntity, baseMm: number): GripSurfaceElevations {
  return {
    top: (p) => slabTopZmmAt(slab.params, p) + baseMm,
    bottom: (p) => slabUndersideZmmAt(slab.params, p) + baseMm,
  };
}

/**
 * ADR-535 Φ3/Φ6 — TOP & BOTTOM surface elevation (mm) for a roof: the top rides the roof's
 * lower-envelope plane via the `roofZmm` SSoT (the SAME height field `computeRoofGeometry`
 * lifts the faces with), the bottom hangs a constant `thickness` vertically below it. Falls
 * back to the world AABB top when the roof is absent from the store.
 */
function roofGripSurfaceElevations(roofId: string, fallbackWorldY: number): GripSurfaceElevations {
  const s = useBim3DEntitiesStore.getState();
  const roof = s.roofs.find((r) => r.id === roofId);
  if (!roof) return flatSurfaceElevations(fallbackWorldY);
  const baseMm = (resolveEntityBuilding(roof, s.floors, s.buildings)?.baseElevation ?? 0) * 1000;
  const verts = roof.params.outline.vertices;
  const scaleS = mmToSceneUnits(roof.params.sceneUnits ?? 'mm');
  const { planes } = resolveEavePlanes(verts, roof.params.edges, roof.params.slopeUnit);
  const thicknessMm = roof.params.thickness;
  const top: PlanElevationMmFor = (p) => roofZmm(planes, roof.params.basePivotZ, scaleS, p) + baseMm;
  return { top, bottom: (p) => top(p) - thicknessMm };
}

/**
 * ADR-535 Φ6 — TOP & BOTTOM surface elevation (mm) for a FLAT floor-finish: the top is the
 * world AABB top (the FFL plane is flat, `fallbackWorldY` is already exact), the bottom is its
 * finish `thicknessMm` below. Reads the finish from `Bim3DEntitiesStore` for the thickness only.
 */
function floorFinishGripSurfaceElevations(finishId: string, fallbackWorldY: number): GripSurfaceElevations {
  const topMm = fallbackWorldY * 1000;
  const finish = useBim3DEntitiesStore.getState().floorFinishes.find((f) => f.id === finishId);
  const thicknessMm = finish?.params.thicknessMm ?? 0;
  return { top: () => topMm, bottom: () => topMm - thicknessMm };
}

/**
 * ADR-535 Φ3b/Φ6 — TOP & BOTTOM surface elevation (mm) for a slab OPENING: both ride the HOST
 * SLAB's top & underside via the SAME `slabTopZmmAt` / `slabUndersideZmmAt` SSoT the slab grips
 * use + the building base. The opening carries no Z of its own. Falls back to the world AABB
 * top when the opening or its host slab is absent from the store.
 */
function slabOpeningGripSurfaceElevations(openingId: string, fallbackWorldY: number): GripSurfaceElevations {
  const slab = resolveSlabOpeningHostSlab(openingId);
  if (!slab) return flatSurfaceElevations(fallbackWorldY);
  const s = useBim3DEntitiesStore.getState();
  const baseMm = (resolveEntityBuilding(slab, s.floors, s.buildings)?.baseElevation ?? 0) * 1000;
  return slabTopBottomElevations(slab, baseMm);
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
  // ADR-602 Stage 4 — read each discriminator once via the tagged accessor (hoisted).
  const slabKind = gripKindOf(grip, 'slab');
  if (slabKind) return buildSlabReshapePreviewObject(grip.entityId, slabKind, deltaMm);
  const roofKind = gripKindOf(grip, 'roof');
  if (roofKind) return buildRoofReshapePreviewObject(grip.entityId, roofKind, deltaMm);
  const floorFinishKind = gripKindOf(grip, 'floor-finish');
  if (floorFinishKind) {
    return buildFloorFinishReshapePreviewObject(grip.entityId, floorFinishKind, deltaMm);
  }
  // ADR-535 Φ3b — slab-opening: rebuild the HOST SLAB with the moved hole (entityId = opening id).
  const slabOpeningKind = gripKindOf(grip, 'slab-opening');
  if (slabOpeningKind) {
    return buildSlabOpeningReshapePreviewObject(grip.entityId, slabOpeningKind, deltaMm);
  }
  // ADR-535 Φ7 — column cross-section reshape (corner / edge / parametric face / poly-vertex).
  const columnKind = gripKindOf(grip, 'column');
  if (columnKind) {
    return buildColumnReshapePreviewObject(grip.entityId, columnKind, deltaMm);
  }
  // ADR-535 Φ8 — wall cross-section reshape (corner / thickness / length / endpoint / curve /
  // poly-vertex). The grip anchor (`grip.position`) seeds `currentPos` for the thickness resolve.
  const wallKind = gripKindOf(grip, 'wall');
  if (wallKind) {
    return buildWallReshapePreviewObject(grip.entityId, wallKind, deltaMm, grip.position);
  }
  // ADR-535 Φ9 — beam cross-section reshape (corner / width / length edge / endpoint / poly-vertex).
  // The grip anchor (`grip.position`) seeds `currentPos` for the width resolve (mirror wall).
  const beamKind = gripKindOf(grip, 'beam');
  if (beamKind) {
    return buildBeamReshapePreviewObject(grip.entityId, beamKind, deltaMm, grip.position);
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
