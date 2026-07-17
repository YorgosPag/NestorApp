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
import { stampBimIdentity } from '../converters/bim-three-shape-helpers';
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
import { projectPointTo2D, projectVerticesTo2D } from '../../bim/geometry/shared/polygon-utils';

/**
 * Per-type param patch for ONE drag discipline. Each entry maps an entity to its NEXT
 * params, or null for a no-op / degenerate drag. An ABSENT type means the discipline
 * does not support it (stair has no tilt; column/slab have no endpoint handle).
 */
interface PreviewPatch {
  wall?: (wall: Wall) => Wall['params'] | null;
  column?: (column: Column) => Column['params'] | null;
  beam?: (beam: Beam) => Beam['params'] | null;
  slab?: (slab: Slab) => Slab['params'] | null;
  stair?: (stair: Stair) => Stair['params'] | null;
}

/** The single-floor preview snapshot, or null on the multi-floor scope (commit-on-release). */
function previewSnapshot(): { s: Snapshot; levelId: string | undefined } | null {
  // Match the single-floor resync (floorElevationMm = 0). Multi-floor → commit-on-release.
  if (useViewMode3DStore.getState().floor3DScope === 'all') return null;
  const s = useBim3DEntitiesStore.getState();
  return { s, levelId: s.activeLevelId ?? undefined };
}

/** The preview snapshot plus the wall `wallId` names, or null (multi-floor / unknown wall). */
function wallPreviewSnapshot(wallId: string): { s: Snapshot; levelId: string | undefined; wall: Wall } | null {
  const ctx = previewSnapshot();
  if (!ctx) return null;
  const wall = ctx.s.walls.find((w) => w.id === wallId);
  return wall ? { ...ctx, wall } : null;
}

/**
 * The ONE preview dispatch: find `entityId` across the supported types and rebuild it
 * through its converter with the patched params. Every drag discipline (resize / tilt /
 * endpoint) differs ONLY in the patch function per type — never in the lookup, the
 * geometry recompute, the attach-profile resolution, or the converter call.
 */
function buildPatchedPreview(entityId: string, patch: PreviewPatch): THREE.Object3D | null {
  const ctx = previewSnapshot();
  if (!ctx) return null;
  const { s, levelId } = ctx;
  const wall = s.walls.find((w) => w.id === entityId);
  if (wall) return patch.wall ? wallMesh(wall, patch.wall(wall), s, levelId) : null;
  const column = s.columns.find((c) => c.id === entityId);
  if (column) return patch.column ? columnMesh(column, patch.column(column), s, levelId) : null;
  const beam = s.beams.find((b) => b.id === entityId);
  if (beam) return patch.beam ? beamMesh(beam, patch.beam(beam), s, levelId) : null;
  const slab = s.slabs.find((sl) => sl.id === entityId);
  if (slab) return patch.slab ? slabMesh(slab, patch.slab(slab), s, levelId) : null;
  const stair = s.stairs.find((st) => st.id === entityId);
  if (stair) return patch.stair ? stairMesh(stair, patch.stair(stair), s, levelId) : null;
  return null;
}

/** Build the live resize-preview object for `entityId`, or null (no-op / unsupported / multi-floor). */
export function buildResizePreviewObject(entityId: string, drag: ResizeDragMm): THREE.Object3D | null {
  return buildPatchedPreview(entityId, {
    wall: (w) => computeWallResizeParams(w.params, drag),
    column: (c) => computeColumnResizeParams(c.params, drag),
    beam: (b) => computeBeamResizeParams(b.params, drag),
    slab: (sl) => computeSlabResizeParams(sl.params, drag),
    stair: (st) => computeStairResizeParams(st, drag),
  });
}

/**
 * Build the live tilt-preview object for `entityId`, or null (no-op / unsupported /
 * multi-floor). ADR-404 Phase 2 — the tilt sibling of `buildResizePreviewObject`:
 * apply the per-type tilt patch (`bim3d-tilt-bridge`) → recompute geometry → rebuild
 * through the SAME converter the commit path uses, so the live preview === the
 * committed shear (the converters read `tilt`/`topElevationEnd`/`slope`). Stair has
 * no tilt → absent → null. Flat-path limitation (attached/openings) mirrors resize.
 */
export function buildTiltPreviewObject(entityId: string, drag: TiltDragDeg): THREE.Object3D | null {
  return buildPatchedPreview(entityId, {
    wall: (w) => computeWallTiltParams(w.params, drag),
    column: (c) => computeColumnTiltParams(c.params, drag),
    beam: (b) => computeBeamTiltParams(b.params, drag),
    slab: (sl) => computeSlabTiltParams(sl.params, drag),
  });
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
  const ctx = previewSnapshot();
  if (!ctx) return null;
  const { s, levelId } = ctx;
  const segment = s.mepSegments.find((seg) => seg.id === entityId);
  if (segment) {
    const deltaCanvas = scaleDeltaToEntity(segment, deltaMm);
    const next = computeMepSegmentEndpointMove(segment.params, endpoint, deltaCanvas, deltaUpMm);
    if (!next) return null;
    const baseElevationM = resolveEntityBuilding(segment, s.floors, s.buildings)?.baseElevation ?? 0;
    return mepSegmentToMesh({ ...segment, params: next }, 0, levelId, baseElevationM);
  }
  // wall / beam — horizontal length only (`deltaUpMm` ignored, ADR-408 Φ1).
  return buildPatchedPreview(entityId, {
    wall: (w) => computeWallEndpointMove(w.params, endpoint, scaleDeltaToEntity(w, deltaMm)),
    beam: (b) => computeBeamEndpointMove(b.params, endpoint, scaleDeltaToEntity(b, deltaMm)),
  });
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
  const ctx = wallPreviewSnapshot(wallId);
  if (!ctx) return null;
  const { s, levelId, wall } = ctx;
  const others = s.openings.filter((o) => o.params.wallId === wallId && o.id !== movedOpeningId);
  let openings: readonly Opening[] = others;
  if (movedParams) {
    const base = s.openings.find((o) => o.id === movedOpeningId);
    if (base) {
      const units = wall.params.sceneUnits ?? 'mm';
      openings = [...others, { ...base, params: movedParams, geometry: computeOpeningGeometry(movedParams, wall, units) }];
    }
  }
  // The wall itself is unpatched — only its hole set moves.
  return wallMeshFrom(wall, wall, s, levelId, { openings });
}

/** DXF-mm gizmo delta → the entity's native canvas units (mirror move/rotate/resize). */
function scaleDeltaToEntity(entity: Entity, deltaMm: Point2D): Point2D {
  const f = mmToEntityUnitFactor(entity);
  return f === 1 ? deltaMm : { x: deltaMm.x * f, y: deltaMm.y * f };
}

type Snapshot = ReturnType<typeof useBim3DEntitiesStore.getState>;
type Wall = Bim3DEntities['walls'][number];
type Column = Bim3DEntities['columns'][number];
type Beam = Bim3DEntities['beams'][number];
type Slab = Bim3DEntities['slabs'][number];
type Stair = Bim3DEntities['stairs'][number];
type Opening = Bim3DEntities['openings'][number];

/** Base elevation for the converter — the entity's building base (mirror of BimSceneLayer). */
function baseElevationOf(entity: Wall | Column | Beam | Slab | Stair, s: Snapshot): number {
  return resolveEntityBuilding(entity, s.floors, s.buildings)?.baseElevation ?? 0;
}

/**
 * Attach top/base profiles for the preview wall — mirror of `BimSceneLayer.syncWalls`
 * (`floorElevationMm = 0`). Non-attached → `{}` (fast path, byte-for-byte). Host inputs
 * (beams + slabs) come from the SAME snapshot the resync reads, unless the caller passes
 * its own — the live host-move preview shifts the hosts before resolving (ADR-401).
 */
// ADR-535 Φ8 — exported so the 3D wall reshape-grip preview (bim3d-grip-preview-builders)
// reuses the SAME attach top/base profile resolution the resize/tilt/endpoint previews use
// (one SSoT), so a reshaped attached wall previews with its real stepped/sloped top/base.
export function wallPreviewProfiles(
  wall: Wall,
  s: Snapshot,
  hosts?: readonly HostFootprintInput[],
): { profile?: WallTopProfile; baseProfile?: WallBaseProfile } {
  const topAttached = wall.params?.topBinding === 'attached';
  const baseAttached = wall.params?.baseBinding === 'attached';
  if (!topAttached && !baseAttached) return {};
  const hostInputs = hosts ?? buildWallHostInputs(s.beams, s.slabs, s.roofs);
  const start = projectPointTo2D(wall.params.start);
  const end = projectPointTo2D(wall.params.end);
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
// ADR-535 Φ8 — exported alongside `wallPreviewProfiles` for the 3D wall reshape-grip preview.
export function wallPreviewTopClip(
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
// ADR-535 Φ7 — exported so the 3D column reshape-grip preview (bim3d-grip-preview-builders)
// reuses the SAME attach top/base profile resolution the resize/tilt previews use (one SSoT).
export function columnPreviewProfiles(column: Column, s: Snapshot): { topProfile?: ColumnTopProfile; baseProfile?: ColumnBaseProfile } {
  const topAttached = column.params?.topBinding === 'attached';
  const baseAttached = column.params?.baseBinding === 'attached';
  const footVerts = column.geometry?.footprint?.vertices;
  if ((!topAttached && !baseAttached) || !footVerts || footVerts.length < 3) return {};
  const footprint = projectVerticesTo2D(footVerts);
  const colCtx = { floorElevationMm: 0, resolveHostInput: makeColumnHostResolver(buildWallHostInputs(s.beams, s.slabs, s.roofs)) };
  return {
    topProfile: topAttached ? resolveColumnTopProfile(column.params, footprint, colCtx) : undefined,
    baseProfile: baseAttached ? resolveColumnBaseProfile(column.params, footprint, colCtx) : undefined,
  };
}

/**
 * Wall preview mesh — mirror of `BimSceneLayer.syncWalls` (`floorElevationMm = 0`).
 * `preview` carries the patched params; `wall` stays the ORIGINAL (its building base
 * elevation and hole set do not move with the drag). `over` substitutes the hosts (a
 * live-moving structural host) or the openings (a dragged hole) while keeping ONE
 * converter call site — ADR-401 Κενό Β: every path passes the footprint clip, so an
 * attached wall previews with its real angled-crossing top (ghost === commit).
 */
function wallMeshFrom(
  wall: Wall,
  preview: Wall,
  s: Snapshot,
  levelId: string | undefined,
  over?: { hostInputs?: readonly HostFootprintInput[]; openings?: readonly Opening[] },
): THREE.Object3D | null {
  const hosts = over?.hostInputs ?? buildWallHostInputs(s.beams, s.slabs, s.roofs);
  const openings = over?.openings ?? s.openings.filter((o) => o.params.wallId === wall.id);
  const { profile, baseProfile } = wallPreviewProfiles(preview, s, hosts);
  const topClip = wallPreviewTopClip(preview, hosts, 0);
  return wallToMesh(preview, openings, 0, levelId, baseElevationOf(wall, s), profile, baseProfile, topClip);
}

function wallMesh(wall: Wall, next: Wall['params'] | null, s: Snapshot, levelId: string | undefined): THREE.Object3D | null {
  if (!next) return null;
  return wallMeshFrom(wall, { ...wall, params: next, geometry: computeWallGeometry(next, wall.kind) }, s, levelId);
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
  const ctx = wallPreviewSnapshot(wallId);
  if (!ctx) return null;
  const { s, levelId, wall } = ctx;
  const d = worldToDxfPlan(liveTranslation); // world (m) → plan (mm) delta
  const hostInputs = buildWallHostInputs(s.beams, s.slabs, s.roofs).map((h) =>
    movedHostIds.has(h.hostId) ? shiftHost(h, d.x, d.y, d.z) : h,
  );
  // The wall itself is unpatched — only its hosts moved.
  return wallMeshFrom(wall, wall, s, levelId, { hostInputs });
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

function columnMesh(column: Column, next: Column['params'] | null, s: Snapshot, levelId: string | undefined): THREE.Object3D | null {
  if (!next) return null;
  const preview = { ...column, params: next, geometry: computeColumnGeometry(next) };
  const { topProfile, baseProfile } = columnPreviewProfiles(preview, s);
  return columnToMesh(preview, 0, levelId, baseElevationOf(column, s), topProfile, baseProfile);
}

function beamMesh(beam: Beam, next: Beam['params'] | null, s: Snapshot, levelId: string | undefined): THREE.Object3D | null {
  if (!next) return null;
  return beamToMesh({ ...beam, params: next, geometry: computeBeamGeometry(next) }, levelId, baseElevationOf(beam, s));
}

function slabMesh(slab: Slab, next: Slab['params'] | null, s: Snapshot, levelId: string | undefined): THREE.Object3D | null {
  if (!next) return null;
  const openings = s.slabOpenings.filter((o) => o.params.slabId === slab.id);
  return slabToMesh({ ...slab, params: next }, openings, levelId, baseElevationOf(slab, s));
}

/**
 * ADR-535 Φ2/Φ3 — the live RESHAPE-grip preview builders (slab / roof / floor-finish)
 * moved to `bim3d-grip-preview-builders.ts` (Google file-size N.7.1). This module keeps
 * the resize / tilt / endpoint preview machinery.
 */

function stairMesh(stair: Stair, next: Stair['params'] | null, s: Snapshot, levelId: string | undefined): THREE.Object3D | null {
  if (!next) return null;
  const preview = { ...stair, params: next, geometry: computeStairGeometry(next) };
  const meshes = stairToMeshes(preview, 0, levelId, baseElevationOf(stair, s));
  if (meshes.length === 0) return null;
  // applyResize swaps a SINGLE object — wrap the stair's meshes (already identity-tagged).
  // ADR-669 Φάση Β′ — the wrapper carries the FULL identity, not just `bimId`: a node that
  // answers "which element" must also answer "which category" (Revit's ElementId always has
  // one). `matId` stays absent — the stair resolves material per component (ADR-669 §4.1).
  const group = new THREE.Group();
  stampBimIdentity(group, { bimId: stair.id, bimType: 'stair' });
  for (const m of meshes) group.add(m);
  return group;
}
