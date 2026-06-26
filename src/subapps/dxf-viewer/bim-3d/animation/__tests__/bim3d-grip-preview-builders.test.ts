/**
 * ADR-535 Φ3 — buildRoofReshapePreviewObject / buildFloorFinishReshapePreviewObject:
 * live per-vertex / edge-midpoint reshape preview for a dragged 3D roof / floor-finish
 * grip. Seeds the real zustand store and asserts the Φ2 invariant per type:
 *   - a vertex drag builds an object whose geometry === the SAME apply*GripDrag +
 *     converter the commit path uses (ghost === commit);
 *   - an edge-midpoint drag inserts a vertex (more outline geometry);
 *   - no-op / unknown id / multi-floor scope fall back to null (commit-on-release).
 */

import * as THREE from 'three';
import {
  buildRoofReshapePreviewObject,
  buildFloorFinishReshapePreviewObject,
  buildSlabOpeningReshapePreviewObject,
} from '../bim3d-grip-preview-builders';
import { applyRoofGripDrag } from '../../../bim/roofs/roof-grips';
import { applyFloorFinishGripDrag } from '../../../bim/floor-finishes/floor-finish-grips';
import { applySlabOpeningGripDrag } from '../../../bim/slab-openings/slab-opening-grips';
import { applyRoofShapePreset, computeRoofGeometry } from '../../../bim/geometry/roof-geometry';
import { computeSlabOpeningGeometry } from '../../../bim/geometry/slab-opening-geometry';
import { roofToMesh } from '../../converters/roof-to-three';
import { floorFinishToMesh } from '../../converters/floor-finish-to-three';
import { slabToMesh } from '../../converters/BimToThreeConverter';
import { useBim3DEntitiesStore } from '../../stores/Bim3DEntitiesStore';
import { useViewMode3DStore } from '../../stores/ViewMode3DStore';
import type { Point3D, Polygon3D } from '../../../bim/types/bim-base';
import type { RoofEntity, RoofParams } from '../../../bim/types/roof-types';
import type { FloorFinishEntity, FloorFinishParams } from '../../../bim/types/floor-finish-types';
import type { SlabEntity, SlabParams } from '../../../bim/types/slab-types';
import type { SlabOpeningEntity, SlabOpeningParams } from '../../../bim/types/slab-opening-types';
import {
  DEFAULT_FLOOR_FINISH_LAYER_THICKNESS_MM,
  DEFAULT_FLOOR_FINISH_MATERIAL_ID,
} from '../../../bim/types/floor-finish-types';

const RECT: Point3D[] = [
  { x: 0, y: 0, z: 0 },
  { x: 4000, y: 0, z: 0 },
  { x: 4000, y: 3000, z: 0 },
  { x: 0, y: 3000, z: 0 },
];

function roofParams(verts: Point3D[] = RECT): RoofParams {
  const outline: Polygon3D = { vertices: verts };
  return {
    outline,
    edges: applyRoofShapePreset(outline, 'gable', 30, 'deg'),
    slopeUnit: 'deg',
    basePivotZ: 3000,
    thickness: 200,
    sceneUnits: 'mm',
  };
}

function makeRoof(): RoofEntity {
  const params = roofParams();
  return { id: 'r', type: 'roof', params, geometry: computeRoofGeometry(params) } as unknown as RoofEntity;
}

function ffParams(side = 4000): FloorFinishParams {
  return {
    footprint: { vertices: [
      { x: 0, y: 0, z: 0 }, { x: side, y: 0, z: 0 }, { x: side, y: side, z: 0 }, { x: 0, y: side, z: 0 },
    ] },
    materialId: DEFAULT_FLOOR_FINISH_MATERIAL_ID,
    thicknessMm: DEFAULT_FLOOR_FINISH_LAYER_THICKNESS_MM,
    finishLevel: 0,
    sceneUnits: 'mm',
  };
}

function makeFloorFinish(): FloorFinishEntity {
  return {
    id: 'f', type: 'floor-finish', kind: DEFAULT_FLOOR_FINISH_MATERIAL_ID, ifcType: 'IfcCovering',
    layerId: '0', params: ffParams(), geometry: {} as FloorFinishEntity['geometry'],
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null }, visible: true,
  } as unknown as FloorFinishEntity;
}

/** All position-attribute points across the object tree (mesh geometry). */
function positions(obj: THREE.Object3D): { x: number; y: number; z: number }[] {
  const out: { x: number; y: number; z: number }[] = [];
  obj.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const p = o.geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) out.push({ x: p.getX(i), y: p.getY(i), z: p.getZ(i) });
  });
  return out;
}

function seed(): void {
  useBim3DEntitiesStore.setState({
    slabs: [], slabOpenings: [], roofs: [makeRoof()], floorFinishes: [makeFloorFinish()],
    floors: [], buildings: [], activeLevelId: null,
  });
  useViewMode3DStore.getState().setFloor3DScope('single');
}

describe('buildRoofReshapePreviewObject (ADR-535 Φ3)', () => {
  beforeEach(seed);

  it('vertex drag === the commit transform (applyRoofGripDrag + roofToMesh) — ghost === commit', () => {
    const delta = { x: 500, y: 300 };
    const preview = buildRoofReshapePreviewObject('r', 'roof-vertex-2', delta);
    expect(preview).not.toBeNull();
    const next = applyRoofGripDrag('roof-vertex-2', { originalParams: roofParams(), delta, rectilinear: false });
    const expected = roofToMesh({ ...makeRoof(), params: next, geometry: computeRoofGeometry(next) }, undefined, 0);
    expect(expected).not.toBeNull();
    const a = positions(preview!);
    const b = positions(expected!);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i].x).toBeCloseTo(b[i].x, 6);
      expect(a[i].y).toBeCloseTo(b[i].y, 6);
      expect(a[i].z).toBeCloseTo(b[i].z, 6);
    }
  });

  it('edge-midpoint drag inserts a vertex (more outline geometry, edges stay in lockstep)', () => {
    const base = positions(roofToMesh(makeRoof(), undefined, 0)!).length;
    const inserted = buildRoofReshapePreviewObject('r', 'roof-edge-midpoint-0', { x: 0, y: 500 });
    expect(inserted).not.toBeNull();
    expect(positions(inserted!).length).toBeGreaterThan(base);
  });

  it('returns null for a zero-delta no-op', () => {
    expect(buildRoofReshapePreviewObject('r', 'roof-vertex-2', { x: 0, y: 0 })).toBeNull();
  });

  it('returns null for an unknown entity id', () => {
    expect(buildRoofReshapePreviewObject('missing', 'roof-vertex-0', { x: 100, y: 100 })).toBeNull();
  });

  it('falls back to commit-on-release for the multi-floor scope', () => {
    useViewMode3DStore.getState().setFloor3DScope('all');
    expect(buildRoofReshapePreviewObject('r', 'roof-vertex-2', { x: 500, y: 500 })).toBeNull();
  });
});

describe('buildFloorFinishReshapePreviewObject (ADR-535 Φ3)', () => {
  beforeEach(seed);

  it('vertex drag === the commit transform (applyFloorFinishGripDrag + floorFinishToMesh)', () => {
    const delta = { x: 500, y: 300 };
    const preview = buildFloorFinishReshapePreviewObject('f', 'floor-finish-vertex-2', delta);
    expect(preview).not.toBeNull();
    const next = applyFloorFinishGripDrag('floor-finish-vertex-2', { originalParams: ffParams(), delta, rectilinear: false });
    const expected = floorFinishToMesh({ ...makeFloorFinish(), params: next }, 0, undefined, 0);
    expect(expected).not.toBeNull();
    const a = positions(preview!);
    const b = positions(expected!);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i].x).toBeCloseTo(b[i].x, 6);
      expect(a[i].y).toBeCloseTo(b[i].y, 6);
      expect(a[i].z).toBeCloseTo(b[i].z, 6);
    }
  });

  it('edge-midpoint drag inserts a vertex (more outline geometry than the quad)', () => {
    const quad = positions(floorFinishToMesh(makeFloorFinish(), 0, undefined, 0)!).length;
    const inserted = buildFloorFinishReshapePreviewObject('f', 'floor-finish-edge-midpoint-0', { x: 0, y: 500 });
    expect(inserted).not.toBeNull();
    expect(positions(inserted!).length).toBeGreaterThan(quad);
  });

  it('returns null for a zero-delta no-op', () => {
    expect(buildFloorFinishReshapePreviewObject('f', 'floor-finish-vertex-2', { x: 0, y: 0 })).toBeNull();
  });

  it('returns null for an unknown entity id', () => {
    expect(buildFloorFinishReshapePreviewObject('missing', 'floor-finish-vertex-0', { x: 100, y: 100 })).toBeNull();
  });

  it('falls back to commit-on-release for the multi-floor scope', () => {
    useViewMode3DStore.getState().setFloor3DScope('all');
    expect(buildFloorFinishReshapePreviewObject('f', 'floor-finish-vertex-2', { x: 500, y: 500 })).toBeNull();
  });
});

// ─── ADR-535 Φ3b — slab-opening (host slab rebuild with the moved hole) ──────────

function openingHostSlab(): SlabEntity {
  const params: SlabParams = {
    kind: 'floor',
    outline: { vertices: [
      { x: 0, y: 0, z: 0 }, { x: 6000, y: 0, z: 0 }, { x: 6000, y: 5000, z: 0 }, { x: 0, y: 5000, z: 0 },
    ] },
    levelElevation: 3000,
    thickness: 200,
    geometryType: 'box',
    sceneUnits: 'mm',
  } as SlabParams;
  return { id: 'sl', type: 'slab', kind: 'floor', ifcType: 'IfcSlab', layerId: '0', params, geometry: {} } as unknown as SlabEntity;
}

function openingParams(): SlabOpeningParams {
  return {
    kind: 'shaft',
    slabId: 'sl',
    outline: { vertices: [
      { x: 1000, y: 1000, z: 0 }, { x: 2500, y: 1000, z: 0 }, { x: 2500, y: 2200, z: 0 }, { x: 1000, y: 2200, z: 0 },
    ] },
    sceneUnits: 'mm',
  } as SlabOpeningParams;
}

function makeOpening(): SlabOpeningEntity {
  const params = openingParams();
  return {
    id: 'op', type: 'slab-opening', kind: 'shaft', layerId: '0', params,
    geometry: computeSlabOpeningGeometry(params),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null }, visible: true,
  } as unknown as SlabOpeningEntity;
}

function seedSlabOpening(): void {
  useBim3DEntitiesStore.setState({
    slabs: [openingHostSlab()], slabOpenings: [makeOpening()], roofs: [], floorFinishes: [],
    floors: [], buildings: [], activeLevelId: null,
  });
  useViewMode3DStore.getState().setFloor3DScope('single');
}

describe('buildSlabOpeningReshapePreviewObject (ADR-535 Φ3b)', () => {
  beforeEach(seedSlabOpening);

  it('vertex drag rebuilds the HOST SLAB with the moved hole === the commit re-sync — ghost === commit', () => {
    const delta = { x: 400, y: 250 };
    const preview = buildSlabOpeningReshapePreviewObject('op', 'slab-opening-vertex-2', delta);
    expect(preview).not.toBeNull();
    // Commit SSoT: applySlabOpeningGripDrag → computeSlabOpeningGeometry → slabToMesh(host).
    const next = applySlabOpeningGripDrag('slab-opening-vertex-2', { originalParams: openingParams(), delta, rectilinear: false });
    const moved = { ...makeOpening(), params: next, geometry: computeSlabOpeningGeometry(next) };
    const expected = slabToMesh(openingHostSlab(), [moved], undefined, 0);
    expect(expected).not.toBeNull();
    const a = positions(preview!);
    const b = positions(expected!);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i].x).toBeCloseTo(b[i].x, 6);
      expect(a[i].y).toBeCloseTo(b[i].y, 6);
      expect(a[i].z).toBeCloseTo(b[i].z, 6);
    }
  });

  it('edge-midpoint drag inserts a hole vertex (more hole geometry than the rectangular shaft)', () => {
    const base = positions(slabToMesh(openingHostSlab(), [makeOpening()], undefined, 0)!).length;
    const inserted = buildSlabOpeningReshapePreviewObject('op', 'slab-opening-edge-midpoint-0', { x: 0, y: 300 });
    expect(inserted).not.toBeNull();
    expect(positions(inserted!).length).toBeGreaterThan(base);
  });

  it('returns null for a zero-delta no-op', () => {
    expect(buildSlabOpeningReshapePreviewObject('op', 'slab-opening-vertex-2', { x: 0, y: 0 })).toBeNull();
  });

  it('returns null for an unknown opening id', () => {
    expect(buildSlabOpeningReshapePreviewObject('missing', 'slab-opening-vertex-0', { x: 100, y: 100 })).toBeNull();
  });

  it('returns null when the host slab is absent (orphan opening)', () => {
    useBim3DEntitiesStore.setState({ slabs: [] });
    expect(buildSlabOpeningReshapePreviewObject('op', 'slab-opening-vertex-2', { x: 400, y: 250 })).toBeNull();
  });

  it('falls back to commit-on-release for the multi-floor scope', () => {
    useViewMode3DStore.getState().setFloor3DScope('all');
    expect(buildSlabOpeningReshapePreviewObject('op', 'slab-opening-vertex-2', { x: 400, y: 250 })).toBeNull();
  });
});
