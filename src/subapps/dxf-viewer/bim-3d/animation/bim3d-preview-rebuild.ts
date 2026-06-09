'use client';

/**
 * bim3d-preview-rebuild.ts — rebuild ONE resized BIM entity's 3D object for the
 * live resize preview (ADR-402, live move/rotate/resize preview).
 *
 * A resize changes a dimension, not a transform, so the rigid-mesh preview in
 * `bim3d-edit-live-preview.ts` cannot show it. This module produces a fresh THREE
 * object for the dragged entity using the SAME SSoT the commit path uses:
 *   resize outcome → `compute*ResizeParams` (bim3d-resize-bridge) → new params →
 *   `compute*Geometry` → the public converter (`wallToMesh`/`columnToMesh`/…).
 * So the live preview === the committed result for that entity (ghost === commit).
 *
 * Inputs come from the SAME canonical sources `BimSceneLayer` reads — the domain
 * entities + floors/buildings in `Bim3DEntitiesStore` and `resolveEntityBuilding`
 * for the base elevation — WITHOUT importing `BimSceneLayer` (it is owned by other
 * in-flight ADR work). `floorElevationMm` is 0, matching the single-floor resync
 * (`bim3d-resync`); the "Όλοι οι όροφοι" multi-floor scope falls back to commit-on-
 * release (returns null) since per-floor elevation is not modelled here.
 *
 * ADR-401 ↔ ADR-402/404 fix: attached-wall / attached-column top/base PROFILES ARE now
 * re-resolved here (mirror `BimSceneLayer.syncWalls`/`syncColumns`), so an attached element
 * previews with its real stepped/sloped top/base — and the kept-on-commit preview matches
 * the release re-sync (no flat-top drift, no vanish). Non-attached → undefined profiles →
 * byte-for-byte fast path. `floorElevationMm = 0` (single-floor resync convention).
 */

import * as THREE from 'three';
import type { ResizeDragMm } from '../gizmo/bim3d-resize-bridge';
import {
  computeColumnResizeParams,
  computeWallResizeParams,
  computeBeamResizeParams,
  computeSlabResizeParams,
  computeStairResizeParams,
} from '../gizmo/bim3d-resize-bridge';
import {
  computeColumnTiltParams,
  computeWallTiltParams,
  computeBeamTiltParams,
  computeSlabTiltParams,
  type TiltDragDeg,
} from '../gizmo/bim3d-tilt-bridge';
import { wallToMesh, columnToMesh, beamToMesh, slabToMesh } from '../converters/BimToThreeConverter';
// ADR-408 Φ-D — endpoint-move preview of the dragged MEP segment (converter SSoT).
import { mepSegmentToMesh } from '../converters/mep-segment-to-mesh';
import {
  computeMepSegmentEndpointMove,
  computeWallEndpointMove,
  computeBeamEndpointMove,
} from '../gizmo/bim3d-endpoint-move';
import { mmToEntityUnitFactor } from '../utils/bim3d-edit-math';
import type { Entity } from '../../types/entities';
import type { GizmoEndpoint } from '../gizmo/gizmo-types';
import type { Point2D } from '../../rendering/types/Types';
// ADR-401 — wall-top footprint clip (γωνιακή διασταύρωση): the live preview MUST
// pass the 8th `topClip` arg so attached walls preview with the same 5/7-piece
// footprint clip + face-crossing breakpoints the commit path (`syncWalls`) builds.
import { wallTopFaceCrossingBreakpoints, type WallTopClipContext } from '../converters/wall-top-clip';
import { worldToDxfPlan } from '../viewport/coordinate-transforms';
import { stairToMeshes } from '../converters/StairToThreeConverter';
import { computeWallGeometry } from '../../bim/geometry/wall-geometry';
// ADR-363 Φ1G.5 Slice 2g — live moving wall hole (rebuild the host wall with the dragged opening).
import { computeOpeningGeometry } from '../../bim/geometry/opening-geometry';
import type { OpeningParams } from '../../bim/types/opening-types';
import { computeColumnGeometry } from '../../bim/geometry/column-geometry';
import { computeBeamGeometry } from '../../bim/geometry/beam-geometry';
import { computeStairGeometry } from '../../bim/geometry/stairs/StairGeometryService';
import { resolveEntityBuilding } from '../../bim/utils/bim-floor-utils';
// ADR-401 ↔ ADR-402/404 — attach profiles so the preview === the committed `syncWalls`/
// `syncColumns` result for attached walls/columns (no flat-top drift → no vanish on commit).
import { resolveWallTopProfile, resolveWallNominalTopZmm, type WallTopProfile } from '../../bim/geometry/wall-top-profile';
import { resolveWallBaseProfile, type WallBaseProfile } from '../../bim/geometry/wall-base-profile';
import {
  buildWallHostInputs,
  makeWallTopContext,
  makeWallBaseContext,
  type HostFootprintInput,
  type Pt2,
} from '../../bim/geometry/wall-host-plan-builder';
import {
  resolveColumnTopProfile,
  resolveColumnBaseProfile,
  makeColumnHostResolver,
  type ColumnTopProfile,
  type ColumnBaseProfile,
} from '../../bim/geometry/column-vertical-profile';
import { useBim3DEntitiesStore, type Bim3DEntities } from '../stores/Bim3DEntitiesStore';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';

/** Build the live resize-preview object for `entityId`, or null (no-op / unsupported / multi-floor). */
export function buildResizePreviewObject(entityId: string, drag: ResizeDragMm): THREE.Object3D | null {
  // Match the single-floor resync (floorElevationMm = 0). Multi-floor → commit-on-release.
  if (useViewMode3DStore.getState().floor3DScope === 'all') return null;
  const s = useBim3DEntitiesStore.getState();
  const levelId = s.activeLevelId ?? undefined;

  const wall = s.walls.find((w) => w.id === entityId);
  if (wall) return rebuildWall(wall, drag, s, levelId);
  const column = s.columns.find((c) => c.id === entityId);
  if (column) return rebuildColumn(column, drag, s, levelId);
  const beam = s.beams.find((b) => b.id === entityId);
  if (beam) return rebuildBeam(beam, drag, s, levelId);
  const slab = s.slabs.find((sl) => sl.id === entityId);
  if (slab) return rebuildSlab(slab, drag, s, levelId);
  const stair = s.stairs.find((st) => st.id === entityId);
  if (stair) return rebuildStair(stair, drag, s, levelId);
  return null;
}

/**
 * Build the live tilt-preview object for `entityId`, or null (no-op / unsupported /
 * multi-floor). ADR-404 Phase 2 — the tilt sibling of `buildResizePreviewObject`:
 * apply the per-type tilt patch (`bim3d-tilt-bridge`) → recompute geometry → rebuild
 * through the SAME converter the commit path uses, so the live preview === the
 * committed shear (the converters read `tilt`/`topElevationEnd`/`slope`). Stair has
 * no tilt → null. Flat-path limitation (attached/openings) mirrors resize (ADR-402).
 */
export function buildTiltPreviewObject(entityId: string, drag: TiltDragDeg): THREE.Object3D | null {
  if (useViewMode3DStore.getState().floor3DScope === 'all') return null;
  const s = useBim3DEntitiesStore.getState();
  const levelId = s.activeLevelId ?? undefined;

  const wall = s.walls.find((w) => w.id === entityId);
  if (wall) {
    const next = computeWallTiltParams(wall.params, drag);
    if (!next) return null;
    const preview = { ...wall, params: next, geometry: computeWallGeometry(next, wall.kind) };
    const openings = s.openings.filter((o) => o.params.wallId === wall.id);
    const { profile, baseProfile } = wallPreviewProfiles(preview, s);
    const topClip = wallPreviewTopClip(preview, buildWallHostInputs(s.beams, s.slabs, s.roofs), 0);
    return wallToMesh(preview, openings, 0, levelId, baseElevationOf(wall, s), profile, baseProfile, topClip);
  }
  const column = s.columns.find((c) => c.id === entityId);
  if (column) {
    const next = computeColumnTiltParams(column.params, drag);
    if (!next) return null;
    const preview = { ...column, params: next, geometry: computeColumnGeometry(next) };
    const { topProfile, baseProfile } = columnPreviewProfiles(preview, s);
    return columnToMesh(preview, 0, levelId, baseElevationOf(column, s), topProfile, baseProfile);
  }
  const beam = s.beams.find((b) => b.id === entityId);
  if (beam) {
    const next = computeBeamTiltParams(beam.params, drag);
    if (!next) return null;
    const preview = { ...beam, params: next, geometry: computeBeamGeometry(next) };
    return beamToMesh(preview, levelId, baseElevationOf(beam, s));
  }
  const slab = s.slabs.find((sl) => sl.id === entityId);
  if (slab) {
    const next = computeSlabTiltParams(slab.params, drag);
    if (!next) return null;
    const preview = { ...slab, params: next };
    const openings = s.slabOpenings.filter((o) => o.params.slabId === slab.id);
    return slabToMesh(preview, openings, levelId, baseElevationOf(slab, s));
  }
  return null;
}

/**
 * ADR-408 Φ-D/Φ1 — build the live endpoint-move preview of the DRAGGED linear element,
 * or null (no-op / not found / multi-floor). Mirrors `buildResizePreviewObject`: apply
 * the endpoint-move patch (`bim3d-endpoint-move`) → rebuild through the SAME converter
 * the commit re-sync uses, so the ghost === the committed result. Three disciplines:
 * `mep-segment` (free-3D pipe, `deltaUpMm` used), `wall` / `beam` (horizontal length,
 * `deltaUpMm` ignored). The plan delta (DXF mm) is scaled into the entity's native
 * canvas units. Pipe followers are rebuilt separately via `buildPipeFollowPreviewObjects`.
 */
export function buildEndpointMovePreviewObject(
  entityId: string,
  endpoint: GizmoEndpoint,
  deltaMm: Point2D,
  deltaUpMm: number,
): THREE.Object3D | null {
  if (useViewMode3DStore.getState().floor3DScope === 'all') return null;
  const s = useBim3DEntitiesStore.getState();
  const levelId = s.activeLevelId ?? undefined;
  const segment = s.mepSegments.find((seg) => seg.id === entityId);
  if (segment) {
    const deltaCanvas = scaleDeltaToEntity(segment, deltaMm);
    const next = computeMepSegmentEndpointMove(segment.params, endpoint, deltaCanvas, deltaUpMm);
    if (!next) return null;
    const baseElevationM = resolveEntityBuilding(segment, s.floors, s.buildings)?.baseElevation ?? 0;
    return mepSegmentToMesh({ ...segment, params: next }, 0, levelId, baseElevationM);
  }
  const wall = s.walls.find((w) => w.id === entityId);
  if (wall) return rebuildWallEndpoint(wall, endpoint, scaleDeltaToEntity(wall, deltaMm), s, levelId);
  const beam = s.beams.find((b) => b.id === entityId);
  if (beam) return rebuildBeamEndpoint(beam, endpoint, scaleDeltaToEntity(beam, deltaMm), s, levelId);
  return null;
}

/**
 * ADR-363 Φ1G.5 Slice 2g — live preview of an opening's HOST WALL while the opening is
 * dragged (Revit moving hole). Rebuilds the wall through the SAME `wallToMesh` SSoT the
 * commit re-sync uses: the wall mesh shows the hole at the dragged offset AND
 * `attachOpeningMeshes` re-attaches the SOLID opening body (κάσα/φύλλο/υαλοστάσιο) there
 * too — so ghost === commit, with no separate body build. `movedParams === null` rebuilds
 * the wall WITHOUT the opening (the OLD host on a re-host: the hole closes live). Returns
 * null on the multi-floor scope or an unknown wall (→ caller falls back / skips).
 */
export function buildOpeningHostWallPreview(
  wallId: string,
  movedOpeningId: string,
  movedParams: OpeningParams | null,
): THREE.Object3D | null {
  if (useViewMode3DStore.getState().floor3DScope === 'all') return null;
  const s = useBim3DEntitiesStore.getState();
  const wall = s.walls.find((w) => w.id === wallId);
  if (!wall) return null;
  const levelId = s.activeLevelId ?? undefined;
  const others = s.openings.filter((o) => o.params.wallId === wallId && o.id !== movedOpeningId);
  let openings = others;
  if (movedParams) {
    const base = s.openings.find((o) => o.id === movedOpeningId);
    if (base) {
      const units = wall.params.sceneUnits ?? 'mm';
      openings = [...others, { ...base, params: movedParams, geometry: computeOpeningGeometry(movedParams, wall, units) }];
    }
  }
  const { profile, baseProfile } = wallPreviewProfiles(wall, s);
  const topClip = wallPreviewTopClip(wall, buildWallHostInputs(s.beams, s.slabs, s.roofs), 0);
  return wallToMesh(wall, openings, 0, levelId, baseElevationOf(wall, s), profile, baseProfile, topClip);
}

/** DXF-mm gizmo delta → the entity's native canvas units (mirror move/rotate/resize). */
function scaleDeltaToEntity(entity: Entity, deltaMm: Point2D): Point2D {
  const f = mmToEntityUnitFactor(entity);
  return f === 1 ? deltaMm : { x: deltaMm.x * f, y: deltaMm.y * f };
}

/** ADR-408 Φ1 — live length-handle preview of a wall (ghost === committed `syncWalls`). */
function rebuildWallEndpoint(
  wall: Wall,
  endpoint: GizmoEndpoint,
  deltaCanvas: Point2D,
  s: Snapshot,
  levelId: string | undefined,
): THREE.Object3D | null {
  const next = computeWallEndpointMove(wall.params, endpoint, deltaCanvas);
  if (!next) return null;
  const preview = { ...wall, params: next, geometry: computeWallGeometry(next, wall.kind) };
  const openings = s.openings.filter((o) => o.params.wallId === wall.id);
  const { profile, baseProfile } = wallPreviewProfiles(preview, s);
  const topClip = wallPreviewTopClip(preview, buildWallHostInputs(s.beams, s.slabs, s.roofs), 0);
  return wallToMesh(preview, openings, 0, levelId, baseElevationOf(wall, s), profile, baseProfile, topClip);
}

/** ADR-408 Φ1 — live length-handle preview of a beam (ghost === committed `syncBeams`). */
function rebuildBeamEndpoint(
  beam: Beam,
  endpoint: GizmoEndpoint,
  deltaCanvas: Point2D,
  s: Snapshot,
  levelId: string | undefined,
): THREE.Object3D | null {
  const next = computeBeamEndpointMove(beam.params, endpoint, deltaCanvas);
  if (!next) return null;
  const preview = { ...beam, params: next, geometry: computeBeamGeometry(next) };
  return beamToMesh(preview, levelId, baseElevationOf(beam, s));
}

type Snapshot = ReturnType<typeof useBim3DEntitiesStore.getState>;
type Wall = Bim3DEntities['walls'][number];
type Column = Bim3DEntities['columns'][number];
type Beam = Bim3DEntities['beams'][number];
type Slab = Bim3DEntities['slabs'][number];
type Stair = Bim3DEntities['stairs'][number];

/** Base elevation for the converter — the entity's building base (mirror of BimSceneLayer). */
function baseElevationOf(entity: Wall | Column | Beam | Slab | Stair, s: Snapshot): number {
  return resolveEntityBuilding(entity, s.floors, s.buildings)?.baseElevation ?? 0;
}

/**
 * Attach top/base profiles for the preview wall — mirror of `BimSceneLayer.syncWalls`
 * (`floorElevationMm = 0`). Non-attached → `{}` (fast path, byte-for-byte). Host inputs
 * (beams + slabs) come from the SAME snapshot the resync reads.
 */
function wallPreviewProfiles(wall: Wall, s: Snapshot): { profile?: WallTopProfile; baseProfile?: WallBaseProfile } {
  const topAttached = wall.params?.topBinding === 'attached';
  const baseAttached = wall.params?.baseBinding === 'attached';
  if (!topAttached && !baseAttached) return {};
  const hostInputs = buildWallHostInputs(s.beams, s.slabs, s.roofs);
  const start = { x: wall.params.start.x, y: wall.params.start.y };
  const end = { x: wall.params.end.x, y: wall.params.end.y };
  return {
    profile: topAttached
      ? resolveWallTopProfile(wall.params, makeWallTopContext(start, end, hostInputs, { floorElevationMm: 0 }))
      : undefined,
    baseProfile: baseAttached
      ? resolveWallBaseProfile(wall.params, makeWallBaseContext(start, end, hostInputs, { floorElevationMm: 0 }))
      : undefined,
  };
}

/**
 * Wall-top footprint clip for the preview wall — mirror of `BimSceneLayer.syncWalls`
 * (ADR-401 γωνιακή διασταύρωση). Only `straight` top-attached walls clip; others →
 * undefined (the extrude path does not support a diagonal top — documented limitation).
 * Built from the SAME `wallTopFaceCrossingBreakpoints` + `resolveWallNominalTopZmm`
 * SSoT the commit path uses, so the ghost === the committed footprint clip.
 */
function wallPreviewTopClip(
  wall: Wall,
  hostInputs: readonly HostFootprintInput[],
  floorElevationMm: number,
): WallTopClipContext | undefined {
  if (wall.params?.topBinding !== 'attached' || wall.kind !== 'straight') return undefined;
  const attachHosts = hostInputs.filter((h) => wall.params.attachTopToIds?.includes(h.hostId));
  return {
    hosts: attachHosts,
    nominalTopMm: resolveWallNominalTopZmm(wall.params, { floorElevationMm }),
    breakpoints: wallTopFaceCrossingBreakpoints(wall.geometry, attachHosts),
  };
}

/**
 * Attach top/base profiles for the preview column — mirror of `BimSceneLayer.syncColumns`
 * (`floorElevationMm = 0`). Non-attached or geometry-less → `{}` (fast path).
 */
function columnPreviewProfiles(column: Column, s: Snapshot): { topProfile?: ColumnTopProfile; baseProfile?: ColumnBaseProfile } {
  const topAttached = column.params?.topBinding === 'attached';
  const baseAttached = column.params?.baseBinding === 'attached';
  const footVerts = column.geometry?.footprint?.vertices;
  if ((!topAttached && !baseAttached) || !footVerts || footVerts.length < 3) return {};
  const footprint = footVerts.map((v) => ({ x: v.x, y: v.y }));
  const colCtx = { floorElevationMm: 0, resolveHostInput: makeColumnHostResolver(buildWallHostInputs(s.beams, s.slabs, s.roofs)) };
  return {
    topProfile: topAttached ? resolveColumnTopProfile(column.params, footprint, colCtx) : undefined,
    baseProfile: baseAttached ? resolveColumnBaseProfile(column.params, footprint, colCtx) : undefined,
  };
}

function rebuildWall(wall: Wall, drag: ResizeDragMm, s: Snapshot, levelId: string | undefined): THREE.Object3D | null {
  const next = computeWallResizeParams(wall.params, drag);
  if (!next) return null;
  const preview = { ...wall, params: next, geometry: computeWallGeometry(next, wall.kind) };
  const openings = s.openings.filter((o) => o.params.wallId === wall.id);
  const { profile, baseProfile } = wallPreviewProfiles(preview, s);
  // ADR-401 Κενό Β — pass the footprint clip so a resized attached wall previews
  // with its real angled-crossing top (ghost === commit), not just the axis profile.
  const topClip = wallPreviewTopClip(preview, buildWallHostInputs(s.beams, s.slabs, s.roofs), 0);
  return wallToMesh(preview, openings, 0, levelId, baseElevationOf(wall, s), profile, baseProfile, topClip);
}

/**
 * ADR-401 — live re-clip of an attached dependent wall while its structural host
 * (beam/slab) is being moved (3D move gizmo, ADR-402). The wall ITSELF does not
 * move; only the hosts in `movedHostIds` shift by `liveTranslation` (world space),
 * so the wall's top footprint clip must be rebuilt with the hosts at their preview
 * position — otherwise the user sees the stale hole until pointer-up.
 *
 * Ghost === commit: the wall is rebuilt through the SAME converter SSoT as
 * `BimSceneLayer.syncWalls` (profiles + `topClip` with face-crossing breakpoints),
 * the only difference being the moved hosts' shifted footprints / undersides.
 * `worldToDxfPlan` maps the world translation vector to a plan (mm) delta — it is a
 * pure linear map (no affine offset), so it applies 1:1 to a delta (anti-1000×).
 */
export function buildDependentWallPreviewObject(
  wallId: string,
  movedHostIds: ReadonlySet<string>,
  liveTranslation: THREE.Vector3,
): THREE.Object3D | null {
  if (useViewMode3DStore.getState().floor3DScope === 'all') return null;
  const s = useBim3DEntitiesStore.getState();
  const wall = s.walls.find((w) => w.id === wallId);
  if (!wall) return null;
  const levelId = s.activeLevelId ?? undefined;
  const d = worldToDxfPlan(liveTranslation); // world (m) → plan (mm) delta
  const hostInputs = buildWallHostInputs(s.beams, s.slabs, s.roofs).map((h) =>
    movedHostIds.has(h.hostId) ? shiftHost(h, d.x, d.y, d.z) : h,
  );
  const start = { x: wall.params.start.x, y: wall.params.start.y };
  const end = { x: wall.params.end.x, y: wall.params.end.y };
  const profile =
    wall.params?.topBinding === 'attached'
      ? resolveWallTopProfile(wall.params, makeWallTopContext(start, end, hostInputs, { floorElevationMm: 0 }))
      : undefined;
  const baseProfile =
    wall.params?.baseBinding === 'attached'
      ? resolveWallBaseProfile(wall.params, makeWallBaseContext(start, end, hostInputs, { floorElevationMm: 0 }))
      : undefined;
  const topClip = wallPreviewTopClip(wall, hostInputs, 0);
  const openings = s.openings.filter((o) => o.params.wallId === wall.id);
  return wallToMesh(wall, openings, 0, levelId, baseElevationOf(wall, s), profile, baseProfile, topClip);
}

/**
 * Shift a host's footprint + under/top-side by a plan (mm) delta, modelling the
 * host at its live-drag position. Sloped hosts keep their slope: the `*At(pt)`
 * planes are re-anchored by querying the original plane at the un-shifted point
 * and adding the elevation delta (`dz`).
 */
function shiftHost(h: HostFootprintInput, dx: number, dy: number, dz: number): HostFootprintInput {
  const undersideAt = h.undersideZmmAt;
  const topsideAt = h.topsideZmmAt;
  return {
    ...h,
    footprint: h.footprint.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    undersideZmm: h.undersideZmm + dz,
    topsideZmm: h.topsideZmm !== undefined ? h.topsideZmm + dz : undefined,
    undersideZmmAt: undersideAt ? (pt: Pt2) => undersideAt({ x: pt.x - dx, y: pt.y - dy }) + dz : undefined,
    topsideZmmAt: topsideAt ? (pt: Pt2) => topsideAt({ x: pt.x - dx, y: pt.y - dy }) + dz : undefined,
  };
}

function rebuildColumn(column: Column, drag: ResizeDragMm, s: Snapshot, levelId: string | undefined): THREE.Object3D | null {
  const next = computeColumnResizeParams(column.params, drag);
  if (!next) return null;
  const preview = { ...column, params: next, geometry: computeColumnGeometry(next) };
  const { topProfile, baseProfile } = columnPreviewProfiles(preview, s);
  return columnToMesh(preview, 0, levelId, baseElevationOf(column, s), topProfile, baseProfile);
}

function rebuildBeam(beam: Beam, drag: ResizeDragMm, s: Snapshot, levelId: string | undefined): THREE.Object3D | null {
  const next = computeBeamResizeParams(beam.params, drag);
  if (!next) return null;
  const preview = { ...beam, params: next, geometry: computeBeamGeometry(next) };
  return beamToMesh(preview, levelId, baseElevationOf(beam, s));
}

function rebuildSlab(slab: Slab, drag: ResizeDragMm, s: Snapshot, levelId: string | undefined): THREE.Object3D | null {
  const next = computeSlabResizeParams(slab.params, drag);
  if (!next) return null;
  const preview = { ...slab, params: next };
  const openings = s.slabOpenings.filter((o) => o.params.slabId === slab.id);
  return slabToMesh(preview, openings, levelId, baseElevationOf(slab, s));
}

function rebuildStair(stair: Stair, drag: ResizeDragMm, s: Snapshot, levelId: string | undefined): THREE.Object3D | null {
  const next = computeStairResizeParams(stair, drag);
  if (!next) return null;
  const preview = { ...stair, params: next, geometry: computeStairGeometry(next) };
  const meshes = stairToMeshes(preview, 0, levelId, baseElevationOf(stair, s));
  if (meshes.length === 0) return null;
  // applyResize swaps a SINGLE object — wrap the stair's meshes (already bimId-tagged).
  const group = new THREE.Group();
  group.userData['bimId'] = stair.id;
  for (const m of meshes) group.add(m);
  return group;
}
