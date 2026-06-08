'use client';

/**
 * bim3d-pipe-follow-preview-rebuild — ADR-408 Φ-C: rebuild the pipe segments
 * connected to a dragged MEP entity for the live 3D move/rotate/vertical preview.
 *
 * Sibling of `bim3d-wire-preview-rebuild` (circuit conduits) and
 * `buildDependentWallPreviewObject` (attached walls): while a fixture / manifold /
 * pipe is dragged, the snapped pipe ends must STRETCH live (Revit "connected ends
 * follow"), not jump on release. The committed twin is the `withConnectedPipeFollow`
 * wrapper in `bim3d-edit-command-builders` — this reuses the SAME pure resolvers
 * (`resolveHostMoveConnectedPipePatches` / `resolveSegmentMoveConnectedPipePatches`)
 * and the SAME rotate/move/vertical param SSoT, so ghost === commit on release.
 *
 * Per frame: re-derive the dragged entity's LIVE next params (apply the gizmo
 * transform in param/canvas space), run the resolver to get the follower pipe
 * patches, and rebuild each follower's mesh via the converter SSoT (`mepSegmentToMesh`).
 *
 * UNITS: the gizmo transform is world (metres). `worldToDxfPlan` → mm; the plan
 * delta / rotate pivot are scaled mm → scene units via `mmScale` (mm→1, m→0.001)
 * before they touch the canvas-unit params (the elevation `z` stays mm). Mirror of
 * `bim3d-wire-preview-rebuild`'s applyDragXform unit handling.
 *
 * @see ./bim3d-edit-live-preview (capturePipes / applyPipes — the swap mechanism)
 * @see ../../bim/mep-segments/mep-move-propagation (the committed resolver twin)
 */

import * as THREE from 'three';
import type { Entity } from '../../types/entities';
import { isMepSegmentEntity, isMepFittingEntity } from '../../types/entities';
import { isMepConnectorHost } from '../../bim/mep-systems/connector-access';
import type { MepSegmentEntity, MepSegmentParams } from '../../bim/types/mep-segment-types';
import {
  resolveHostMoveConnectedPipePatches,
  resolveSegmentMoveConnectedPipePatches,
} from '../../bim/mep-segments/mep-move-propagation';
import { calculateBimMovedGeometry } from '../../bim/utils/bim-move-geometry';
import { calculateBimRotatedGeometry } from '../../bim/transforms/bim-rotate-geometry';
import {
  computeMepHostVerticalMove,
  computeMepSegmentVerticalMove,
} from '../gizmo/bim3d-vertical-move';
import { computeMepSegmentEndpointMove } from '../gizmo/bim3d-endpoint-move';
import type { GizmoEndpoint } from '../gizmo/gizmo-types';
import type { Point2D } from '../../rendering/types/Types';
import { mepSegmentToMesh } from '../converters/mep-segment-to-mesh';
import { mepFittingToMesh } from '../converters/mep-fitting-to-mesh';
import { resolveDesiredFittings } from '../../bim/mep-fittings/mep-fitting-resolve';
import { incidentEntityId } from '../../bim/types/mep-fitting-types';
import { createMepFitting } from '@/services/factories/mep-fitting.factory';
import { worldToDxfPlan } from '../viewport/coordinate-transforms';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { resolveEntityBuilding } from '../../bim/utils/bim-floor-utils';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';

const RAD_TO_DEG = 180 / Math.PI;
/** Below this squared plan delta (canvas units) a move reads as PURELY vertical. */
const PLAN_EPS2 = 1e-9;

/** The live gizmo transform applied to the dragged entity this frame. */
export type PipeDragXform =
  | { readonly kind: 'move'; readonly translation: THREE.Vector3 }
  | { readonly kind: 'rotate'; readonly pivot: THREE.Vector3; readonly angleRad: number }
  // ADR-408 Φ-D — the dragged entity is a segment whose ONE endpoint moved (plan mm
  // + elevation mm). Only the neighbour coincident with that end follows.
  | { readonly kind: 'endpoint'; readonly endpoint: GizmoEndpoint; readonly deltaMm: Point2D; readonly deltaUpMm: number };

/** mm → scene/canvas units for an entity's drawing (mm→1, cm→0.1, m→0.001). */
function entityMmScale(entity: Entity): number {
  const units = (entity as { params?: { sceneUnits?: SceneUnits } }).params?.sceneUnits ?? 'mm';
  return mmToSceneUnits(units);
}

/** Extract `params` from a rotate/move geometry patch, or null. */
function paramsOf(patch: unknown): unknown | null {
  return patch && typeof patch === 'object' && 'params' in patch
    ? ((patch as { params?: unknown }).params ?? null)
    : null;
}

/**
 * Re-derive the dragged entity's LIVE next params under the gizmo transform, reusing
 * the committed SSoT (rotate / plan-move / vertical-move). A pure-vertical move (plan
 * delta ≈ 0, elevation ≠ 0) routes through the elevation SSoT; a horizontal move
 * through the plan-move SSoT; rotation through the rotate SSoT. `null` = unsupported.
 */
function liveNextParams(entity: Entity, xform: PipeDragXform, mmScale: number): unknown | null {
  if (xform.kind === 'rotate') {
    const p = worldToDxfPlan(xform.pivot);
    const pivot = { x: p.x * mmScale, y: p.y * mmScale };
    return paramsOf(calculateBimRotatedGeometry(entity, pivot, xform.angleRad * RAD_TO_DEG));
  }
  if (xform.kind === 'endpoint') {
    // The dragged entity is always a segment whose one endpoint moved (Φ-D).
    if (!isMepSegmentEntity(entity)) return null;
    const deltaCanvas = { x: xform.deltaMm.x * mmScale, y: xform.deltaMm.y * mmScale };
    return computeMepSegmentEndpointMove(entity.params, xform.endpoint, deltaCanvas, xform.deltaUpMm);
  }
  const d = worldToDxfPlan(xform.translation); // world (m) → mm
  const planDx = d.x * mmScale;
  const planDy = d.y * mmScale;
  const dzMm = d.z; // elevation stays mm
  if (planDx * planDx + planDy * planDy < PLAN_EPS2 && dzMm !== 0) {
    if (isMepSegmentEntity(entity)) return computeMepSegmentVerticalMove(entity.params, dzMm);
    const params = (entity as { params?: { mountingElevationMm?: number } }).params;
    return params && typeof params.mountingElevationMm === 'number'
      ? computeMepHostVerticalMove(params as { mountingElevationMm: number }, dzMm)
      : null;
  }
  const moved = paramsOf(calculateBimMovedGeometry(entity, { x: planDx, y: planDy }));
  if (dzMm === 0 || !moved) return moved;
  // ADR-408 Φ-E — combined plan + vertical (vertical plane handle, plane-xy/yz): shift
  // the moved params' elevation too, so the follower preview matches the commit.
  if (isMepSegmentEntity(entity)) return computeMepSegmentVerticalMove(moved as MepSegmentParams, dzMm) ?? moved;
  const mp = moved as { mountingElevationMm?: number };
  return typeof mp.mountingElevationMm === 'number'
    ? computeMepHostVerticalMove(mp as { mountingElevationMm: number }, dzMm)
    : moved;
}

/** Follower patches for one dragged MEP entity under the given next params. */
function followerPatches(entity: Entity, nextParams: unknown, entities: readonly Entity[]) {
  if (isMepSegmentEntity(entity)) {
    return resolveSegmentMoveConnectedPipePatches(entities, entity, nextParams as MepSegmentParams);
  }
  return resolveHostMoveConnectedPipePatches(entities, entity, { ...entity, params: nextParams } as Entity);
}

/**
 * Ids of the pipe segments that will FOLLOW while `draggedIds` are edited (a pipe
 * end is snapped to a dragged host's connector / coincident with a dragged pipe's
 * endpoint). Computed with the identity transform (prev === next) so the resolver's
 * coincidence-based emission yields exactly the connected set. Empty = fast path.
 */
export function connectedPipeSegmentIds(
  draggedIds: ReadonlySet<string>,
  entities: readonly Entity[],
): string[] {
  const out = new Set<string>();
  for (const id of draggedIds) {
    const e = entities.find((x) => x.id === id);
    if (!e || !isMepConnectorHost(e)) continue;
    const patches = isMepSegmentEntity(e)
      ? resolveSegmentMoveConnectedPipePatches(entities, e, e.params)
      : resolveHostMoveConnectedPipePatches(entities, e, e);
    for (const p of patches) if (!draggedIds.has(p.segment.id)) out.add(p.segment.id);
  }
  return [...out];
}

/**
 * Rebuild the stretched meshes of the pipes connected to the dragged MEP entities,
 * with those entities transformed by the live gizmo `xform`. Returns the fresh tubes
 * (tagged `bimId`, ready to swap into the scene group), or `[]` when nothing follows.
 */
export function buildPipeFollowPreviewObjects(
  draggedIds: ReadonlySet<string>,
  xform: PipeDragXform,
  entities: readonly Entity[],
): THREE.Mesh[] {
  const s = useBim3DEntitiesStore.getState();
  const meshes: THREE.Mesh[] = [];
  const seen = new Set<string>();
  for (const id of draggedIds) {
    const e = entities.find((x) => x.id === id);
    if (!e || !isMepConnectorHost(e)) continue;
    const next = liveNextParams(e, xform, entityMmScale(e));
    if (!next) continue;
    for (const p of followerPatches(e, next, entities)) {
      if (draggedIds.has(p.segment.id) || seen.has(p.segment.id)) continue;
      seen.add(p.segment.id);
      const follower = { ...p.segment, params: p.nextParams } as MepSegmentEntity;
      const baseElevationM = resolveEntityBuilding(p.segment, s.floors, s.buildings)?.baseElevation ?? 0;
      const mesh = mepSegmentToMesh(follower, 0, undefined, baseElevationM);
      if (mesh) meshes.push(mesh);
    }
  }
  return meshes;
}

// ─── ADR-408 Φ-D/Φ-E — live FITTING follow (caps/elbows/tees move with the drag) ──
//
// The pipe-end CAP (and any elbow/tee at a junction the drag moves) is a separate
// `mep-fitting` entity produced by the reconciler — without this it stayed stale and
// only jumped on release. Mirror of the pipe follow: per frame, run the SAME pure
// reconciler (`resolveDesiredFittings`) on a TRANSIENT entity list where the dragged
// MEP entity + its follower pipes carry their LIVE next-params, then rebuild the
// fittings incident to the affected segments via the converter SSoT — so the ghost
// === the committed reconciliation. Caps/elbows/tees all follow uniformly.

/** Segment ids whose incident fittings are affected by dragging `draggedIds` (dragged segments + followers). */
function affectedFittingSegmentIds(draggedIds: ReadonlySet<string>, entities: readonly Entity[]): Set<string> {
  const affected = new Set<string>();
  for (const id of draggedIds) {
    const e = entities.find((x) => x.id === id);
    if (e && isMepSegmentEntity(e)) affected.add(id);
  }
  for (const fid of connectedPipeSegmentIds(draggedIds, entities)) affected.add(fid);
  return affected;
}

/**
 * Ids of the existing `mep-fitting` entities incident to a segment the drag moves —
 * the meshes to HIDE during the drag (the live rebuild replaces them). Empty = none.
 */
export function incidentFittingIds(draggedIds: ReadonlySet<string>, entities: readonly Entity[]): string[] {
  const affected = affectedFittingSegmentIds(draggedIds, entities);
  if (affected.size === 0) return [];
  const out: string[] = [];
  for (const e of entities) {
    if (isMepFittingEntity(e) && e.params.incidents.some((i) => affected.has(incidentEntityId(i)))) {
      out.push(e.id);
    }
  }
  return out;
}

/**
 * Rebuild the fitting meshes (caps/elbows/tees) incident to the dragged segment(s) +
 * followers, with everything at its live `xform` pose. Returns fresh fitting objects
 * (tagged `entityId`, ready to swap in), or `[]` when nothing follows. NOTE: runs the
 * full reconciler per frame (mirrors the pipe-follow resolver cost) — acceptable for a
 * single-entity drag; revisit if profiling shows it on very large networks.
 */
export function buildFittingFollowPreviewObjects(
  draggedIds: ReadonlySet<string>,
  xform: PipeDragXform,
  entities: readonly Entity[],
): THREE.Object3D[] {
  const overrides = new Map<string, unknown>();
  const affected = new Set<string>();
  for (const id of draggedIds) {
    const e = entities.find((x) => x.id === id);
    if (!e || !isMepConnectorHost(e)) continue;
    const next = liveNextParams(e, xform, entityMmScale(e));
    if (next) overrides.set(e.id, next); // host connector / segment endpoint moves the junction node
    if (next && isMepSegmentEntity(e)) affected.add(e.id);
    for (const p of followerPatches(e, next ?? e.params, entities)) {
      if (draggedIds.has(p.segment.id)) continue;
      overrides.set(p.segment.id, p.nextParams);
      affected.add(p.segment.id);
    }
  }
  if (affected.size === 0) return [];

  const transient = entities.map((e) => (overrides.has(e.id) ? ({ ...e, params: overrides.get(e.id) } as Entity) : e));
  const anySeg = entities.find((e) => affected.has(e.id) && isMepSegmentEntity(e)) as MepSegmentEntity | undefined;
  const sceneUnits: SceneUnits = anySeg?.params.sceneUnits ?? 'mm';
  const s = useBim3DEntitiesStore.getState();
  const baseElevationM = anySeg ? (resolveEntityBuilding(anySeg, s.floors, s.buildings)?.baseElevation ?? 0) : 0;

  const meshes: THREE.Object3D[] = [];
  for (const draft of resolveDesiredFittings(transient, { sceneUnits })) {
    if (!draft.params.incidents.some((i) => affected.has(incidentEntityId(i)))) continue;
    const entity = createMepFitting({
      params: draft.params,
      geometry: draft.geometry,
      validation: draft.validation,
      layerId: '0',
      visible: true,
    });
    const mesh = mepFittingToMesh(entity, 0, undefined, baseElevationM);
    if (mesh) meshes.push(mesh);
  }
  return meshes;
}
