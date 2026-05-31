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
 * Known minor drift (corrected by the release re-sync, documented in ADR-402):
 * attached-wall / attached-column top/base PROFILES are not re-resolved here, so an
 * attached element renders with a flat top/base during the drag.
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
import { wallToMesh, columnToMesh, beamToMesh, slabToMesh } from '../converters/BimToThreeConverter';
import { stairToMeshes } from '../converters/StairToThreeConverter';
import { computeWallGeometry } from '../../bim/geometry/wall-geometry';
import { computeColumnGeometry } from '../../bim/geometry/column-geometry';
import { computeBeamGeometry } from '../../bim/geometry/beam-geometry';
import { computeStairGeometry } from '../../bim/geometry/stairs/StairGeometryService';
import { resolveEntityBuilding } from '../../bim/utils/bim-floor-utils';
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

function rebuildWall(wall: Wall, drag: ResizeDragMm, s: Snapshot, levelId: string | undefined): THREE.Object3D | null {
  const next = computeWallResizeParams(wall.params, drag);
  if (!next) return null;
  const preview = { ...wall, params: next, geometry: computeWallGeometry(next, wall.kind) };
  const openings = s.openings.filter((o) => o.params.wallId === wall.id);
  return wallToMesh(preview, openings, 0, levelId, baseElevationOf(wall, s));
}

function rebuildColumn(column: Column, drag: ResizeDragMm, s: Snapshot, levelId: string | undefined): THREE.Object3D | null {
  const next = computeColumnResizeParams(column.params, drag);
  if (!next) return null;
  const preview = { ...column, params: next, geometry: computeColumnGeometry(next) };
  return columnToMesh(preview, 0, levelId, baseElevationOf(column, s));
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
