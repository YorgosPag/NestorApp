'use client';

/**
 * bim3d-grip-preview-builders.ts — live per-frame RESHAPE-grip preview builders for the
 * 3D viewport footprint sketch editing (ADR-535 Φ2 slab → Φ3 roof / floor-finish).
 *
 * Each builder is the grip sibling of the converter's commit path: it applies the SAME
 * pure param transform the 2D grips + the `Update*ParamsCommand` use
 * (`apply*GripDrag`), then rebuilds the dragged entity through the SAME public converter
 * (`slabToMesh` / `roofToMesh` / `floorFinishToMesh`). So the live ghost === the
 * committed result (the Φ2 invariant), with zero duplicated geometry. Shift → rectilinear
 * is read from the ONE `ShiftKeyTracker` the commit path reads, so preview === commit even
 * with the ortho modifier held.
 *
 * Extracted from `bim3d-preview-rebuild.ts` (Google file-size N.7.1) so the three grip
 * builders live together, away from the resize/tilt/endpoint preview machinery. Inputs
 * come from the SAME canonical sources `BimSceneLayer` reads — the domain entities +
 * floors/buildings in `Bim3DEntitiesStore`, and `resolveEntityBuilding` for the base
 * elevation. `floorElevationMm = 0` matches the single-floor resync (`bim3d-resync`); the
 * "Όλοι οι όροφοι" multi-floor scope falls back to commit-on-release (returns null).
 */

import type * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import type {
  SlabGripKind, RoofGripKind, FloorFinishGripKind, SlabOpeningGripKind, ColumnGripKind, WallGripKind, BeamGripKind,
} from '../../hooks/grip-types';
import { applySlabGripDrag } from '../../bim/slabs/slab-grips';
import { applyRoofGripDrag } from '../../bim/roofs/roof-grips';
import { applyFloorFinishGripDrag } from '../../bim/floor-finishes/floor-finish-grips';
import { applySlabOpeningGripDrag } from '../../bim/slab-openings/slab-opening-grips';
import { applyColumnGripDrag } from '../../bim/columns/column-grips';
import { applyWallGripDrag } from '../../bim/walls/wall-grips';
import { applyBeamGripDrag } from '../../bim/beams/beam-grips';
import { computeRoofGeometry } from '../../bim/geometry/roof-geometry';
import { computeSlabOpeningGeometry } from '../../bim/geometry/slab-opening-geometry';
import { computeColumnGeometry } from '../../bim/geometry/column-geometry';
import { computeWallGeometry } from '../../bim/geometry/wall-geometry';
import { computeBeamGeometry } from '../../bim/geometry/beam-geometry';
import { buildWallHostInputs } from '../../bim/geometry/wall-host-plan-builder';
import { slabToMesh, wallToMesh, beamToMesh } from '../converters/BimToThreeConverter';
import { roofToMesh } from '../converters/roof-to-three';
import { floorFinishToMesh } from '../converters/floor-finish-to-three';
import { columnToMesh } from '../converters/bim-three-structural-converters';
import { columnPreviewProfiles, wallPreviewProfiles, wallPreviewTopClip } from './bim3d-preview-rebuild';
import { ShiftKeyTracker } from '../../keyboard/ShiftKeyTracker';
import { resolveEntityBuilding, type EntityWithStoreyParams } from '../../bim/utils/bim-floor-utils';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';

type Snapshot = ReturnType<typeof useBim3DEntitiesStore.getState>;

/** True for the multi-floor "Όλοι οι όροφοι" scope → no live preview (commit-on-release). */
function isMultiFloorScope(): boolean {
  return useViewMode3DStore.getState().floor3DScope === 'all';
}

/** Base elevation (m) for the converter — the entity's building base (mirror BimSceneLayer). */
function baseElevationM(entity: EntityWithStoreyParams, s: Snapshot): number {
  return resolveEntityBuilding(entity, s.floors, s.buildings)?.baseElevation ?? 0;
}

/**
 * ADR-535 Φ2 — build the live RESHAPE preview object for a dragged slab vertex / edge
 * grip, or null (no-op / not a slab / multi-floor). The grip sibling of `rebuildSlab`:
 * the ONLY change is the param transform — `applySlabGripDrag` (per-vertex translate /
 * edge-midpoint insert) instead of `computeSlabResizeParams`. Everything else (the
 * `slabToMesh` converter SSoT, the openings filter, the multi-floor guard) is reused
 * verbatim, so the ghost === the committed `UpdateSlabParamsCommand`.
 */
export function buildSlabReshapePreviewObject(
  entityId: string,
  gripKind: SlabGripKind,
  deltaMm: Point2D,
): THREE.Object3D | null {
  if (isMultiFloorScope()) return null;
  const s = useBim3DEntitiesStore.getState();
  const slab = s.slabs.find((sl) => sl.id === entityId);
  if (!slab) return null;
  const levelId = s.activeLevelId ?? undefined;
  const rectilinear = ShiftKeyTracker.getSnapshot();
  const next = applySlabGripDrag(gripKind, { originalParams: slab.params, delta: deltaMm, rectilinear });
  if (next === slab.params) return null; // no-op (zero delta / out-of-range index)
  const preview = { ...slab, params: next };
  const openings = s.slabOpenings.filter((o) => o.params.slabId === slab.id);
  return slabToMesh(preview, openings, levelId, baseElevationM(slab, s));
}

/**
 * ADR-535 Φ3 — build the live RESHAPE preview object for a dragged roof footprint vertex
 * / edge grip, or null. Roof sibling of the slab builder: `applyRoofGripDrag` produces
 * the new `RoofParams`, then `computeRoofGeometry` recomputes the sloped solid (roof, in
 * contrast to slab, renders from its precomputed `geometry`) and `roofToMesh` rebuilds it
 * — the SAME SSoT pair `UpdateRoofParamsCommand` uses, so ghost === commit (incl. the
 * `edges` ↔ `vertices` lockstep on edge-midpoint insert).
 */
export function buildRoofReshapePreviewObject(
  entityId: string,
  gripKind: RoofGripKind,
  deltaMm: Point2D,
): THREE.Object3D | null {
  if (isMultiFloorScope()) return null;
  const s = useBim3DEntitiesStore.getState();
  const roof = s.roofs.find((r) => r.id === entityId);
  if (!roof) return null;
  const levelId = s.activeLevelId ?? undefined;
  const rectilinear = ShiftKeyTracker.getSnapshot();
  const next = applyRoofGripDrag(gripKind, { originalParams: roof.params, delta: deltaMm, rectilinear });
  if (next === roof.params) return null; // no-op (zero delta / out-of-range index)
  const preview = { ...roof, params: next, geometry: computeRoofGeometry(next) };
  return roofToMesh(preview, levelId, baseElevationM(roof, s));
}

/**
 * ADR-535 Φ3 — build the live RESHAPE preview object for a dragged floor-finish footprint
 * vertex / edge grip, or null. Floor-finish sibling of the slab builder:
 * `applyFloorFinishGripDrag` produces the new `FloorFinishParams` and `floorFinishToMesh`
 * (which reads `params.footprint` directly, no precomputed geometry needed) rebuilds it —
 * the SAME SSoT `UpdateFloorFinishParamsCommand` uses, so ghost === commit.
 * `floorElevationMm = 0` matches the single-floor resync convention.
 */
export function buildFloorFinishReshapePreviewObject(
  entityId: string,
  gripKind: FloorFinishGripKind,
  deltaMm: Point2D,
): THREE.Object3D | null {
  if (isMultiFloorScope()) return null;
  const s = useBim3DEntitiesStore.getState();
  const ff = s.floorFinishes.find((f) => f.id === entityId);
  if (!ff) return null;
  const levelId = s.activeLevelId ?? undefined;
  const rectilinear = ShiftKeyTracker.getSnapshot();
  const next = applyFloorFinishGripDrag(gripKind, { originalParams: ff.params, delta: deltaMm, rectilinear });
  if (next === ff.params) return null; // no-op (zero delta / out-of-range index)
  const preview = { ...ff, params: next };
  // `FloorFinishParams` δεν έχει storey linkage (weak-type mismatch με `EntityWithStoreyParams`).
  // Το base elevation εξαρτάται μόνο από floorId/buildingId (resolveEntityBuilding) → περνάμε
  // adapter με κενά params· ίδιο runtime αποτέλεσμα (storeyId/offset → floorId fallback).
  const ffElevRef: EntityWithStoreyParams = { floorId: ff.floorId, buildingId: ff.buildingId, params: {} };
  return floorFinishToMesh(preview, 0, levelId, baseElevationM(ffElevRef, s));
}

/**
 * ADR-535 Φ3b — build the live RESHAPE preview object for a dragged slab-OPENING
 * footprint vertex / edge grip, or null (no-op / not found / multi-floor). Special
 * among the footprint builders: an opening has no mesh of its own (it is a void), so
 * the preview rebuilds the HOST SLAB with the moved hole — mirror of
 * `buildOpeningHostWallPreview` (wall analogue). `applySlabOpeningGripDrag` produces
 * the new `SlabOpeningParams`, `computeSlabOpeningGeometry` recomputes its geometry
 * cache, then the host slab is rebuilt through the SAME `slabToMesh` SSoT the commit
 * re-sync uses (the moved opening replaces its old entry in the host's openings list)
 * — so the live ghost === the committed `UpdateSlabOpeningParamsCommand` re-sync. The
 * caller captures the HOST SLAB mesh (not the opening) so this object swaps in live.
 */
export function buildSlabOpeningReshapePreviewObject(
  openingId: string,
  gripKind: SlabOpeningGripKind,
  deltaMm: Point2D,
): THREE.Object3D | null {
  if (isMultiFloorScope()) return null;
  const s = useBim3DEntitiesStore.getState();
  const opening = s.slabOpenings.find((o) => o.id === openingId);
  if (!opening) return null;
  const slab = s.slabs.find((sl) => sl.id === opening.params.slabId);
  if (!slab) return null;
  const levelId = s.activeLevelId ?? undefined;
  const rectilinear = ShiftKeyTracker.getSnapshot();
  const next = applySlabOpeningGripDrag(gripKind, { originalParams: opening.params, delta: deltaMm, rectilinear });
  if (next === opening.params) return null; // no-op (zero delta / out-of-range index)
  const moved = { ...opening, params: next, geometry: computeSlabOpeningGeometry(next) };
  const others = s.slabOpenings.filter((o) => o.params.slabId === slab.id && o.id !== openingId);
  return slabToMesh(slab, [...others, moved], levelId, baseElevationM(slab, s));
}

/**
 * ADR-535 Φ7 — build the live RESHAPE preview object for a dragged COLUMN cross-section
 * grip (corner / edge / parametric face / poly-vertex/edge), or null. Column sibling of the
 * slab builder, but it reuses the column resize/tilt preview SSoT verbatim:
 * `applyColumnGripDrag` produces the new `ColumnParams`, `computeColumnGeometry` recomputes
 * the footprint cache, and `columnToMesh` rebuilds it with the SAME attach top/base profiles
 * (`columnPreviewProfiles`) the gizmo resize/tilt previews use — so a stepped/attached column
 * top reshapes correctly and the ghost === the committed `UpdateColumnParamsCommand` re-sync.
 * `floorElevationMm = 0` matches the single-floor resync convention (mirror `rebuildColumn`).
 */
export function buildColumnReshapePreviewObject(
  entityId: string,
  gripKind: ColumnGripKind,
  deltaMm: Point2D,
): THREE.Object3D | null {
  if (isMultiFloorScope()) return null;
  const s = useBim3DEntitiesStore.getState();
  const column = s.columns.find((c) => c.id === entityId);
  if (!column) return null;
  const levelId = s.activeLevelId ?? undefined;
  // `ColumnGripDragInput` has no `rectilinear` field (the rect-grip engine handles its own
  // constraints); the Shift→ortho modifier the footprint builders read does not apply here.
  const next = applyColumnGripDrag(gripKind, { originalParams: column.params, delta: deltaMm });
  if (next === column.params) return null; // no-op (zero delta / out-of-range index)
  const preview = { ...column, params: next, geometry: computeColumnGeometry(next) };
  const { topProfile, baseProfile } = columnPreviewProfiles(preview, s);
  return columnToMesh(preview, 0, levelId, baseElevationM(column, s), topProfile, baseProfile);
}

/**
 * ADR-535 Φ8 — build the live RESHAPE preview object for a dragged WALL cross-section
 * grip (corner / thickness / length edge / endpoint / curve / poly-vertex), or null.
 * Wall sibling of the column builder, reusing the resize/tilt/endpoint preview SSoT
 * verbatim: `applyWallGripDrag` produces the new `WallParams`, `computeWallGeometry`
 * recomputes the solid, and `wallToMesh` rebuilds it with the SAME openings +
 * attach top/base profiles (`wallPreviewProfiles`) + footprint clip (`wallPreviewTopClip`)
 * the gizmo previews use — so the holes follow the reshaped wall and a stepped/attached
 * top reshapes correctly, with ghost === the committed `UpdateWallParamsCommand` re-sync.
 *
 * Wall-specific (≠ column): `WallGripDragInput` requires `currentPos` for the thickness /
 * rotation resolve, so it is derived from the grip anchor + delta — byte-identical to
 * `commitWallGripDrag` (anchor = `grip.position`; `wall-rotation` is filtered out of the
 * 3D reshape grips, so the picked-pivot branch never runs here). `floorElevationMm = 0`
 * matches the single-floor resync convention (mirror `rebuildWall`).
 */
export function buildWallReshapePreviewObject(
  entityId: string,
  gripKind: WallGripKind,
  deltaMm: Point2D,
  originPos: Point2D,
): THREE.Object3D | null {
  if (isMultiFloorScope()) return null;
  const s = useBim3DEntitiesStore.getState();
  const wall = s.walls.find((w) => w.id === entityId);
  if (!wall) return null;
  const levelId = s.activeLevelId ?? undefined;
  const currentPos: Point2D = translatePoint(originPos, deltaMm);
  const next = applyWallGripDrag(gripKind, { originalParams: wall.params, delta: deltaMm, currentPos });
  if (next === wall.params) return null; // no-op (zero delta / out-of-range vertex index)
  const preview = { ...wall, params: next, geometry: computeWallGeometry(next, wall.kind) };
  const openings = s.openings.filter((o) => o.params.wallId === wall.id);
  const { profile, baseProfile } = wallPreviewProfiles(preview, s);
  const topClip = wallPreviewTopClip(preview, buildWallHostInputs(s.beams, s.slabs, s.roofs), 0);
  return wallToMesh(preview, openings, 0, levelId, baseElevationM(wall, s), profile, baseProfile, topClip);
}

/**
 * ADR-535 Φ9 — build the live RESHAPE preview object for a dragged BEAM cross-section grip
 * (corner / width / length edge / endpoint / poly-vertex), or null. Beam sibling of the wall
 * builder: a straight beam IS a linear extruded member, so it reuses the SAME SSoT pair the
 * commit path uses — `applyBeamGripDrag` produces the new `BeamParams`, `computeBeamGeometry`
 * recomputes the outline cache, and `beamToMesh` rebuilds it — so the live ghost === the
 * committed `UpdateBeamParamsCommand` re-sync.
 *
 * Beam-specific (mirror wall): `BeamGripDragInput.currentPos` is derived from the grip anchor
 * + delta (the width / rotation resolves read it) — byte-identical to `commitBeamGripDrag`
 * (`beam-rotation` is filtered out of the 3D reshape grips, so the picked-pivot branch never
 * runs here). The preview keeps the per-element σοβάς (`suppressFinishSkin = false`, like the
 * other ghosts) and `floorElevationMm = 0` matches the single-floor resync convention. The
 * ceiling-slab top clip is omitted (live ghost shows the full member; the clip re-applies on
 * the committed re-sync).
 */
export function buildBeamReshapePreviewObject(
  entityId: string,
  gripKind: BeamGripKind,
  deltaMm: Point2D,
  originPos: Point2D,
): THREE.Object3D | null {
  if (isMultiFloorScope()) return null;
  const s = useBim3DEntitiesStore.getState();
  const beam = s.beams.find((b) => b.id === entityId);
  if (!beam) return null;
  const levelId = s.activeLevelId ?? undefined;
  const currentPos: Point2D = translatePoint(originPos, deltaMm);
  const next = applyBeamGripDrag(gripKind, { originalParams: beam.params, delta: deltaMm, currentPos });
  if (next === beam.params) return null; // no-op (zero delta / out-of-range vertex index)
  const preview = { ...beam, params: next, geometry: computeBeamGeometry(next) };
  return beamToMesh(preview, levelId, baseElevationM(beam, s), s.walls, s.columns, false, 0);
}
