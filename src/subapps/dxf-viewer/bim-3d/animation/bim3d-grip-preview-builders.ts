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
import type { SlabGripKind, RoofGripKind, FloorFinishGripKind } from '../../hooks/grip-types';
import { applySlabGripDrag } from '../../bim/slabs/slab-grips';
import { applyRoofGripDrag } from '../../bim/roofs/roof-grips';
import { applyFloorFinishGripDrag } from '../../bim/floor-finishes/floor-finish-grips';
import { computeRoofGeometry } from '../../bim/geometry/roof-geometry';
import { slabToMesh } from '../converters/BimToThreeConverter';
import { roofToMesh } from '../converters/roof-to-three';
import { floorFinishToMesh } from '../converters/floor-finish-to-three';
import { ShiftKeyTracker } from '../../keyboard/ShiftKeyTracker';
import { resolveEntityBuilding, type EntityWithStoreyParams } from '../../bim/utils/bim-floor-utils';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';

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
  return floorFinishToMesh(preview, 0, levelId, baseElevationM(ff, s));
}
