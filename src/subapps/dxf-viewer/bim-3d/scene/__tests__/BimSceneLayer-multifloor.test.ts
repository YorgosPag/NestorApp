/**
 * ADR-399 Phase B — BimSceneLayer.syncMultiFloor («Όλοι οι όροφοι»).
 *
 * Verifies the stacked-building build path: one clearGroup, then a per-floor
 * loop that reuses the EXISTING converters with each floor's own
 * `floorElevationMm` + levelId, plus per-floor visibility gating and no mesh
 * accumulation across rebuilds.
 */

import * as THREE from 'three';

const wallToMesh = jest.fn();
const columnToMesh = jest.fn();
const beamToMesh = jest.fn();
const slabToMesh = jest.fn();
const stairToMeshes = jest.fn();
const resolveEntityBuilding = jest.fn();
const getLayer = jest.fn();

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
  resolveEntityBuilding: (...a: unknown[]) => resolveEntityBuilding(...a),
}));
jest.mock('../../../stores/LayerStore', () => ({
  getLayer: (...a: unknown[]) => getLayer(...a),
}));
jest.mock('../../../state/drawing-scale-store', () => ({
  useDrawingScaleStore: { getState: jest.fn() },
}));

import { useDrawingScaleStore } from '../../../state/drawing-scale-store';
import { BimSceneLayer } from '../BimSceneLayer';
import type { Bim3DEntities } from '../../stores/Bim3DEntitiesStore';
import type { FloorStackEntry } from '../multi-floor-3d-source';
import type { FloorVisMode } from '../../utils/floor-visibility-state';

const mockDrawingState = useDrawingScaleStore.getState as jest.Mock;
const FAKE_MESH = (): THREE.Mesh => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));

/**
 * A floor with exactly one wall (other categories empty) for precise counting.
 * The wall carries minimal straight-segment `params` (start/end) so the
 * post-ADR-401 `syncWalls` host-profile resolution runs without crashing; with
 * no `topBinding/baseBinding === 'attached'` the profile args stay undefined.
 */
function wallFloor(wallId: string): Bim3DEntities {
  return {
    walls: [{
      id: wallId,
      kind: 'straight',
      params: { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
    } as unknown as Bim3DEntities['walls'][number]],
    columns: [], beams: [], foundations: [], slabs: [], slabOpenings: [], openings: [], stairs: [],
    fixtures: [], panels: [], railings: [],
  };
}

function meshCount(layer: BimSceneLayer): number {
  let n = 0;
  layer.group.traverse((o) => { if (o instanceof THREE.Mesh) n += 1; });
  return n;
}

beforeEach(() => {
  wallToMesh.mockReset().mockImplementation(() => FAKE_MESH());
  columnToMesh.mockReset().mockImplementation(() => FAKE_MESH());
  beamToMesh.mockReset().mockImplementation(() => FAKE_MESH());
  slabToMesh.mockReset().mockImplementation(() => FAKE_MESH());
  stairToMeshes.mockReset().mockImplementation(() => [FAKE_MESH()]);
  resolveEntityBuilding.mockReset().mockReturnValue({ id: '', baseElevation: 0 });
  getLayer.mockReset().mockReturnValue(null);
  mockDrawingState.mockReturnValue({ objectStyles: {} });
});

describe('BimSceneLayer.syncMultiFloor — ADR-399 Phase B', () => {
  const stack: FloorStackEntry[] = [
    { levelId: 'L1', floorElevationMm: 0,    entities: wallFloor('w1') },
    { levelId: 'L2', floorElevationMm: 3000, entities: wallFloor('w2') },
  ];

  it('builds one wall mesh per floor in the stack', () => {
    const layer = new BimSceneLayer(new THREE.Scene());
    layer.syncMultiFloor(stack);
    expect(wallToMesh).toHaveBeenCalledTimes(2);
    expect(meshCount(layer)).toBe(2);
    expect(layer.hasMesh).toBe(true);
  });

  it('passes each floor its own floorElevationMm + levelId to the converter', () => {
    new BimSceneLayer(new THREE.Scene()).syncMultiFloor(stack);
    // wallToMesh(wall, openings, floorElevationMm, activeLevelId, baseElevation, profile?, baseProfile?, topClip?)
    // ADR-401: args 6-8 = WallTopProfile/WallBaseProfile/WallTopClip (all undefined for non-attached walls).
    expect(wallToMesh).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: 'w1' }), expect.anything(), 0, 'L1', expect.anything(), undefined, undefined, undefined);
    expect(wallToMesh).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 'w2' }), expect.anything(), 3000, 'L2', expect.anything(), undefined, undefined, undefined);
  });

  it('skips a floor whose visibility mode is hide (pre-mesh gate)', () => {
    const floorModes = new Map<string, FloorVisMode>([['L2', 'hide']]);
    new BimSceneLayer(new THREE.Scene()).syncMultiFloor(stack, [], [], null, new Map(), floorModes);
    expect(wallToMesh).toHaveBeenCalledTimes(1);
    expect(wallToMesh).toHaveBeenCalledWith(expect.objectContaining({ id: 'w1' }), expect.anything(), 0, 'L1', expect.anything(), undefined, undefined, undefined);
  });

  it('does not accumulate meshes across rebuilds (single clearGroup)', () => {
    const layer = new BimSceneLayer(new THREE.Scene());
    layer.syncMultiFloor(stack);
    layer.syncMultiFloor(stack);
    expect(meshCount(layer)).toBe(2);
  });

  it('empty stack clears the group', () => {
    const layer = new BimSceneLayer(new THREE.Scene());
    layer.syncMultiFloor(stack);
    layer.syncMultiFloor([]);
    expect(meshCount(layer)).toBe(0);
    expect(layer.hasMesh).toBe(false);
  });
});
