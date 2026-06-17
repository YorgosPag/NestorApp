/**
 * ADR-375 Phase C.4 v2.6 — BimSceneLayer V/G visibility hotfix.
 *
 * Verifies the 3D scene layer skips category-specific mesh generation when
 * the per-view override marks that category invisible. Walls/slabs hidden
 * also clear their hosted opening cutouts; opening categories hidden keep
 * host walls/slabs solid (no THREE.Shape holes).
 */

import * as THREE from 'three';

const wallToMesh = jest.fn();
const columnToMesh = jest.fn();
const beamToMesh = jest.fn();
const slabToMesh = jest.fn();
const stairToMeshes = jest.fn();

jest.mock('../../converters/BimToThreeConverter', () => ({
  wallToMesh:   (...a: unknown[]) => wallToMesh(...a),
  columnToMesh: (...a: unknown[]) => columnToMesh(...a),
  beamToMesh:   (...a: unknown[]) => beamToMesh(...a),
  slabToMesh:   (...a: unknown[]) => slabToMesh(...a),
}));
jest.mock('../../converters/StairToThreeConverter', () => ({
  stairToMeshes: (...a: unknown[]) => stairToMeshes(...a),
}));
jest.mock('../../../bim/utils/bim-floor-utils', () => ({
  resolveEntityBuilding: () => ({ id: '', baseElevation: 0 }),
}));

jest.mock('../../../state/drawing-scale-store', () => ({
  useDrawingScaleStore: { getState: jest.fn() },
}));

import { useDrawingScaleStore } from '../../../state/drawing-scale-store';
import { BimSceneLayer } from '../BimSceneLayer';
import { EMPTY_BIM_ENTITIES } from '../../stores/Bim3DEntitiesStore';
import type { Bim3DEntities } from '../../stores/Bim3DEntitiesStore';

const mockGetState = useDrawingScaleStore.getState as jest.Mock;

function setObjectStyles(styles: Record<string, { visible?: boolean }>): void {
  mockGetState.mockReturnValue({ objectStyles: styles });
}

function makeEntities(): Bim3DEntities {
  return {
    ...EMPTY_BIM_ENTITIES,
    walls:        [{ id: 'w1' } as unknown as Bim3DEntities['walls'][number]],
    columns:      [{ id: 'c1' } as unknown as Bim3DEntities['columns'][number]],
    beams:        [{ id: 'b1' } as unknown as Bim3DEntities['beams'][number]],
    slabs:        [{ id: 's1' } as unknown as Bim3DEntities['slabs'][number]],
    slabOpenings: [{ id: 'so1', params: { slabId: 's1' } } as unknown as Bim3DEntities['slabOpenings'][number]],
    openings:     [{ id: 'o1', params: { wallId: 'w1' } } as unknown as Bim3DEntities['openings'][number]],
    stairs:       [{ id: 'st1' } as unknown as Bim3DEntities['stairs'][number]],
  };
}

beforeEach(() => {
  wallToMesh.mockReset().mockReturnValue(null);
  columnToMesh.mockReset().mockReturnValue(null);
  beamToMesh.mockReset().mockReturnValue(null);
  slabToMesh.mockReset().mockReturnValue(null);
  stairToMeshes.mockReset().mockReturnValue([]);
});

describe('BimSceneLayer — V/G category visibility (Phase C.4 v2.6)', () => {
  it('default (no overrides) → all 5 converters called once each', () => {
    setObjectStyles({});
    const scene = new THREE.Scene();
    const layer = new BimSceneLayer(scene);
    layer.sync(makeEntities());

    expect(wallToMesh).toHaveBeenCalledTimes(1);
    expect(columnToMesh).toHaveBeenCalledTimes(1);
    expect(beamToMesh).toHaveBeenCalledTimes(1);
    expect(slabToMesh).toHaveBeenCalledTimes(1);
    expect(stairToMeshes).toHaveBeenCalledTimes(1);
  });

  it('wall.visible=false → wallToMesh skipped, others still fire', () => {
    setObjectStyles({ wall: { visible: false } });
    const scene = new THREE.Scene();
    const layer = new BimSceneLayer(scene);
    layer.sync(makeEntities());

    expect(wallToMesh).not.toHaveBeenCalled();
    expect(columnToMesh).toHaveBeenCalledTimes(1);
    expect(beamToMesh).toHaveBeenCalledTimes(1);
    expect(slabToMesh).toHaveBeenCalledTimes(1);
    expect(stairToMeshes).toHaveBeenCalledTimes(1);
  });

  it('column.visible=false → columnToMesh skipped', () => {
    setObjectStyles({ column: { visible: false } });
    const scene = new THREE.Scene();
    new BimSceneLayer(scene).sync(makeEntities());
    expect(columnToMesh).not.toHaveBeenCalled();
  });

  it('beam.visible=false → beamToMesh skipped', () => {
    setObjectStyles({ beam: { visible: false } });
    const scene = new THREE.Scene();
    new BimSceneLayer(scene).sync(makeEntities());
    expect(beamToMesh).not.toHaveBeenCalled();
  });

  it('slab.visible=false → slabToMesh skipped', () => {
    setObjectStyles({ slab: { visible: false } });
    const scene = new THREE.Scene();
    new BimSceneLayer(scene).sync(makeEntities());
    expect(slabToMesh).not.toHaveBeenCalled();
  });

  it('stair.visible=false → stairToMeshes skipped', () => {
    setObjectStyles({ stair: { visible: false } });
    const scene = new THREE.Scene();
    new BimSceneLayer(scene).sync(makeEntities());
    expect(stairToMeshes).not.toHaveBeenCalled();
  });

  it('opening.visible=false → wallToMesh called with EMPTY openings (host wall stays solid)', () => {
    setObjectStyles({ opening: { visible: false } });
    const scene = new THREE.Scene();
    new BimSceneLayer(scene).sync(makeEntities());

    expect(wallToMesh).toHaveBeenCalledTimes(1);
    const args = wallToMesh.mock.calls[0];
    // 2nd arg = openingsForWall array
    expect(Array.isArray(args[1])).toBe(true);
    expect((args[1] as unknown[]).length).toBe(0);
  });

  it('slab-opening.visible=false → slabToMesh called with EMPTY openings (host slab stays solid)', () => {
    setObjectStyles({ 'slab-opening': { visible: false } });
    const scene = new THREE.Scene();
    new BimSceneLayer(scene).sync(makeEntities());

    expect(slabToMesh).toHaveBeenCalledTimes(1);
    const args = slabToMesh.mock.calls[0];
    expect(Array.isArray(args[1])).toBe(true);
    expect((args[1] as unknown[]).length).toBe(0);
  });

  it('opening visible (default) → wallToMesh receives the opening array', () => {
    setObjectStyles({});
    const scene = new THREE.Scene();
    new BimSceneLayer(scene).sync(makeEntities());

    const args = wallToMesh.mock.calls[0];
    expect((args[1] as unknown[]).length).toBe(1);
  });

  it('all 5 categories hidden → group has zero children', () => {
    setObjectStyles({
      wall:   { visible: false },
      column: { visible: false },
      beam:   { visible: false },
      slab:   { visible: false },
      stair:  { visible: false },
    });
    const scene = new THREE.Scene();
    const layer = new BimSceneLayer(scene);
    layer.sync(makeEntities());

    expect(wallToMesh).not.toHaveBeenCalled();
    expect(columnToMesh).not.toHaveBeenCalled();
    expect(beamToMesh).not.toHaveBeenCalled();
    expect(slabToMesh).not.toHaveBeenCalled();
    expect(stairToMeshes).not.toHaveBeenCalled();
    expect(layer.group.children.length).toBe(0);
    expect(layer.hasMesh).toBe(false);
  });
});
