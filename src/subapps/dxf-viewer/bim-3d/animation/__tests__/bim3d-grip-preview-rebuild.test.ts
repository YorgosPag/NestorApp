/**
 * ADR-535 Φ2 — buildSlabReshapePreviewObject: live per-vertex / edge-midpoint reshape
 * preview for a dragged 3D slab grip. Seeds the real zustand store with a square slab
 * and asserts:
 *   - a vertex drag builds an object whose geometry === the SAME applySlabGripDrag +
 *     slabToMesh the commit path uses (ghost === commit, the Φ2 invariant);
 *   - an edge-midpoint drag inserts a vertex (more outline geometry);
 *   - no-op / unknown id / multi-floor scope fall back to null (commit-on-release).
 */

import * as THREE from 'three';
import { buildSlabReshapePreviewObject } from '../bim3d-preview-rebuild';
import { slabToMesh } from '../../converters/BimToThreeConverter';
import { applySlabGripDrag } from '../../../bim/slabs/slab-grips';
import { useBim3DEntitiesStore } from '../../stores/Bim3DEntitiesStore';
import { useViewMode3DStore } from '../../stores/ViewMode3DStore';
import type { SlabEntity, SlabParams } from '../../../bim/types/slab-types';

/** 1×1 m (canonical-mm: 1000×1000) τετράγωνο, γωνία στο (0,0). */
const SQUARE = {
  vertices: [
    { x: 0, y: 0, z: 0 },
    { x: 1000, y: 0, z: 0 },
    { x: 1000, y: 1000, z: 0 },
    { x: 0, y: 1000, z: 0 },
  ],
};

function makeSlab(): SlabEntity {
  const params: SlabParams = {
    kind: 'roof',
    outline: SQUARE,
    levelElevation: 3000,
    thickness: 200,
    geometryType: 'box',
    sceneUnits: 'mm',
  } as SlabParams;
  return {
    id: 's', type: 'slab', kind: params.kind, ifcType: 'IfcSlab', layerId: '0', params,
    geometry: {} as SlabEntity['geometry'],
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null }, visible: true,
  } as unknown as SlabEntity;
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

describe('buildSlabReshapePreviewObject (ADR-535 Φ2)', () => {
  beforeEach(() => {
    useBim3DEntitiesStore.setState({
      slabs: [makeSlab()],
      slabOpenings: [],
      floors: [],
      buildings: [],
      activeLevelId: null,
    });
    useViewMode3DStore.getState().setFloor3DScope('single');
  });

  it('vertex drag === the commit transform (applySlabGripDrag + slabToMesh) — ghost === commit', () => {
    const delta = { x: 500, y: 300 };
    const preview = buildSlabReshapePreviewObject('s', 'slab-vertex-2', delta);
    expect(preview).not.toBeNull();
    // Reproduce the commit path exactly (no openings, base elevation 0).
    const nextParams = applySlabGripDrag('slab-vertex-2', { originalParams: makeSlab().params, delta, rectilinear: false });
    const expected = slabToMesh({ ...makeSlab(), params: nextParams }, [], undefined, 0);
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

  it('dragging a corner outward enlarges the footprint (bbox grows on +X)', () => {
    const base = slabToMesh(makeSlab(), [], undefined, 0)!;
    const dragged = buildSlabReshapePreviewObject('s', 'slab-vertex-2', { x: 800, y: 0 })!;
    const baseMax = new THREE.Box3().setFromObject(base).max.x;
    const dragMax = new THREE.Box3().setFromObject(dragged).max.x;
    expect(dragMax).toBeGreaterThan(baseMax);
  });

  it('edge-midpoint drag inserts a vertex (more outline geometry than the quad)', () => {
    const quad = positions(slabToMesh(makeSlab(), [], undefined, 0)!).length;
    const inserted = buildSlabReshapePreviewObject('s', 'slab-edge-midpoint-0', { x: 0, y: 500 });
    expect(inserted).not.toBeNull();
    expect(positions(inserted!).length).toBeGreaterThan(quad);
  });

  it('returns null for a zero-delta no-op', () => {
    expect(buildSlabReshapePreviewObject('s', 'slab-vertex-2', { x: 0, y: 0 })).toBeNull();
  });

  it('returns null for an unknown entity id', () => {
    expect(buildSlabReshapePreviewObject('missing', 'slab-vertex-0', { x: 100, y: 100 })).toBeNull();
  });

  it('falls back to commit-on-release for the multi-floor scope', () => {
    useViewMode3DStore.getState().setFloor3DScope('all');
    expect(buildSlabReshapePreviewObject('s', 'slab-vertex-2', { x: 500, y: 500 })).toBeNull();
  });
});
