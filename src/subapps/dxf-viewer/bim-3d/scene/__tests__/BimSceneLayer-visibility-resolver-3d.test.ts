/**
 * ADR-382 Phase C — BimSceneLayer 3D visibility resolver integration.
 *
 * Verifies per-entity pre-mesh filter via `resolveIsEntityVisible()` for the
 * 4 runtime sources (V/G + Layer + Floor + Building) with ANY-hides-wins
 * intersection. Covers ADR-382 §5.2 scenarios #16-#19 (3D pipeline).
 *
 * 2D-side scenarios #13-#15 are covered by per-renderer tests (resolver swap-in
 * is identical across the 7 BIM 2D renderers — ADR-382 §3.2).
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
import type { FloorVisMode } from '../../utils/floor-visibility-state';
import type { BuildingVisMode } from '../../utils/building-visibility-state';

const mockDrawingState = useDrawingScaleStore.getState as jest.Mock;

interface MockLayerOpts {
  visible?: boolean;
  frozen?: boolean;
}

function setObjectStyles(styles: Record<string, { visible?: boolean }>): void {
  mockDrawingState.mockReturnValue({ objectStyles: styles });
}

function setLayerLookup(map: Record<string, MockLayerOpts>): void {
  getLayer.mockImplementation((id: string) => {
    if (!(id in map)) return null;
    const opts = map[id];
    return {
      id,
      name: id,
      visible: opts.visible ?? true,
      frozen: opts.frozen ?? false,
      locked: false,
      color: '#ffffff',
      transparency: 0,
    };
  });
}

function setBuildingResolution(map: Record<string, string>): void {
  // Maps entity id → buildingId
  resolveEntityBuilding.mockImplementation((entity: { id: string }) => {
    const buildingId = map[entity.id];
    return buildingId ? { id: buildingId, baseElevation: 0 } : undefined;
  });
}

function makeEntities(): Bim3DEntities {
  return {
    walls:        [{ id: 'w1', layerId: 'walls-layer' } as unknown as Bim3DEntities['walls'][number]],
    columns:      [{ id: 'c1', layerId: 'cols-layer' } as unknown as Bim3DEntities['columns'][number]],
    beams:        [{ id: 'b1', layerId: 'beams-layer' } as unknown as Bim3DEntities['beams'][number]],
    slabs:        [{ id: 's1', layerId: 'slabs-layer' } as unknown as Bim3DEntities['slabs'][number]],
    slabOpenings: [{ id: 'so1', layerId: 'so-layer', params: { slabId: 's1' } } as unknown as Bim3DEntities['slabOpenings'][number]],
    openings:     [{ id: 'o1', layerId: 'op-layer', params: { wallId: 'w1' } } as unknown as Bim3DEntities['openings'][number]],
    stairs:       [{ id: 'st1', layerId: 'stairs-layer' } as unknown as Bim3DEntities['stairs'][number]],
    fixtures:     [],
    railings:     [],
  };
}

const FAKE_MESH = (): THREE.Mesh => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));

beforeEach(() => {
  wallToMesh.mockReset().mockImplementation(() => FAKE_MESH());
  columnToMesh.mockReset().mockImplementation(() => FAKE_MESH());
  beamToMesh.mockReset().mockImplementation(() => FAKE_MESH());
  slabToMesh.mockReset().mockImplementation(() => FAKE_MESH());
  stairToMeshes.mockReset().mockImplementation(() => [FAKE_MESH()]);
  resolveEntityBuilding.mockReset().mockReturnValue({ id: '', baseElevation: 0 });
  getLayer.mockReset().mockReturnValue(null);
  setObjectStyles({});
});

describe('BimSceneLayer ADR-382 Phase C — Layer source (#16 — 3D hide via Layer)', () => {
  it('layer.visible=false → wallToMesh skipped (per-entity Layer filter)', () => {
    setLayerLookup({ 'walls-layer': { visible: false } });
    const scene = new THREE.Scene();
    new BimSceneLayer(scene).sync(makeEntities());
    expect(wallToMesh).not.toHaveBeenCalled();
    expect(columnToMesh).toHaveBeenCalledTimes(1);
  });

  it('layer.frozen=true → columnToMesh skipped (frozen treated as hidden)', () => {
    setLayerLookup({ 'cols-layer': { frozen: true } });
    const scene = new THREE.Scene();
    new BimSceneLayer(scene).sync(makeEntities());
    expect(columnToMesh).not.toHaveBeenCalled();
    expect(wallToMesh).toHaveBeenCalledTimes(1);
  });

  it('layer.visible=true + V/G visible → mesh produced (full chain ok)', () => {
    setLayerLookup({ 'walls-layer': { visible: true, frozen: false } });
    const scene = new THREE.Scene();
    new BimSceneLayer(scene).sync(makeEntities());
    expect(wallToMesh).toHaveBeenCalledTimes(1);
  });

  it('entity without layerId → layer constraint skipped, mesh produced', () => {
    setLayerLookup({}); // getLayer returns null for unknown ids
    const entities = makeEntities();
    // Strip layerId from wall
    (entities.walls[0] as unknown as { layerId?: string }).layerId = undefined;
    const scene = new THREE.Scene();
    new BimSceneLayer(scene).sync(entities);
    expect(wallToMesh).toHaveBeenCalledTimes(1);
  });
});

describe('BimSceneLayer ADR-382 Phase C — Floor source', () => {
  it('floor mode=hide → all category meshes skipped (pre-mesh filter)', () => {
    const floorModes = new Map<string, FloorVisMode>([['level-1', 'hide']]);
    const scene = new THREE.Scene();
    new BimSceneLayer(scene).sync(makeEntities(), 0, 'level-1', [], [], null, new Map(), floorModes);
    expect(wallToMesh).not.toHaveBeenCalled();
    expect(columnToMesh).not.toHaveBeenCalled();
    expect(beamToMesh).not.toHaveBeenCalled();
    expect(slabToMesh).not.toHaveBeenCalled();
    expect(stairToMeshes).not.toHaveBeenCalled();
  });

  it('floor mode=ghost → meshes built (Q4 ghost is stylistic only)', () => {
    const floorModes = new Map<string, FloorVisMode>([['level-1', 'ghost']]);
    const scene = new THREE.Scene();
    new BimSceneLayer(scene).sync(makeEntities(), 0, 'level-1', [], [], null, new Map(), floorModes);
    expect(wallToMesh).toHaveBeenCalledTimes(1);
    expect(columnToMesh).toHaveBeenCalledTimes(1);
  });

  it('floor mode=show → meshes built normally', () => {
    const floorModes = new Map<string, FloorVisMode>([['level-1', 'show']]);
    const scene = new THREE.Scene();
    new BimSceneLayer(scene).sync(makeEntities(), 0, 'level-1', [], [], null, new Map(), floorModes);
    expect(wallToMesh).toHaveBeenCalledTimes(1);
  });

  it('floor mode unset (no entry in map) → defaults visible', () => {
    const floorModes = new Map<string, FloorVisMode>(); // empty
    const scene = new THREE.Scene();
    new BimSceneLayer(scene).sync(makeEntities(), 0, 'level-1', [], [], null, new Map(), floorModes);
    expect(wallToMesh).toHaveBeenCalledTimes(1);
  });
});

describe('BimSceneLayer ADR-382 Phase C — Building source (#18 — building hide)', () => {
  it('building mode=hide → entities in that building skipped', () => {
    setBuildingResolution({ w1: 'bldg-A', c1: 'bldg-B' });
    const buildingModes = new Map<string, BuildingVisMode>([['bldg-A', 'hide'], ['bldg-B', 'show']]);
    const scene = new THREE.Scene();
    new BimSceneLayer(scene).sync(makeEntities(), 0, undefined, [], [], null, buildingModes);
    expect(wallToMesh).not.toHaveBeenCalled();
    expect(columnToMesh).toHaveBeenCalledTimes(1);
  });

  it('building mode=ghost → mesh built', () => {
    setBuildingResolution({ w1: 'bldg-A' });
    const buildingModes = new Map<string, BuildingVisMode>([['bldg-A', 'ghost']]);
    const scene = new THREE.Scene();
    new BimSceneLayer(scene).sync(makeEntities(), 0, undefined, [], [], null, buildingModes);
    expect(wallToMesh).toHaveBeenCalledTimes(1);
  });
});

describe('BimSceneLayer ADR-382 Phase C — Intersection (#17 — ANY-hides-wins)', () => {
  it('Layer visible + V/G hide → mesh skipped (V/G wins)', () => {
    setLayerLookup({ 'walls-layer': { visible: true } });
    setObjectStyles({ wall: { visible: false } });
    const scene = new THREE.Scene();
    new BimSceneLayer(scene).sync(makeEntities());
    expect(wallToMesh).not.toHaveBeenCalled();
  });

  it('V/G visible + Layer hide → mesh skipped (Layer wins)', () => {
    setLayerLookup({ 'cols-layer': { visible: false } });
    setObjectStyles({}); // V/G visible
    const scene = new THREE.Scene();
    new BimSceneLayer(scene).sync(makeEntities());
    expect(columnToMesh).not.toHaveBeenCalled();
  });

  it('Floor ghost + V/G hide walls → walls hidden (Q4: hide stronger than ghost)', () => {
    setObjectStyles({ wall: { visible: false } });
    const floorModes = new Map<string, FloorVisMode>([['level-1', 'ghost']]);
    const scene = new THREE.Scene();
    new BimSceneLayer(scene).sync(makeEntities(), 0, 'level-1', [], [], null, new Map(), floorModes);
    expect(wallToMesh).not.toHaveBeenCalled();
    expect(columnToMesh).toHaveBeenCalledTimes(1);
  });

  it('All 4 sources visible → mesh built', () => {
    setLayerLookup({ 'walls-layer': { visible: true } });
    setObjectStyles({});
    setBuildingResolution({ w1: 'bldg-A' });
    const buildingModes = new Map<string, BuildingVisMode>([['bldg-A', 'show']]);
    const floorModes = new Map<string, FloorVisMode>([['level-1', 'show']]);
    const scene = new THREE.Scene();
    new BimSceneLayer(scene).sync(makeEntities(), 0, 'level-1', [], [], null, buildingModes, floorModes);
    expect(wallToMesh).toHaveBeenCalledTimes(1);
  });
});

describe('BimSceneLayer ADR-382 Phase C — Hosted openings per-entity filter', () => {
  it('opening Layer hidden → wallToMesh receives empty openings (host wall stays solid)', () => {
    setLayerLookup({ 'op-layer': { visible: false } });
    const scene = new THREE.Scene();
    new BimSceneLayer(scene).sync(makeEntities());

    expect(wallToMesh).toHaveBeenCalledTimes(1);
    const args = wallToMesh.mock.calls[0];
    expect((args[1] as unknown[]).length).toBe(0);
  });

  it('opening Layer visible → wallToMesh receives the opening (cutout punches through)', () => {
    setLayerLookup({ 'op-layer': { visible: true } });
    const scene = new THREE.Scene();
    new BimSceneLayer(scene).sync(makeEntities());

    const args = wallToMesh.mock.calls[0];
    expect((args[1] as unknown[]).length).toBe(1);
  });

  it('slab-opening Layer hidden → slabToMesh receives empty openings (host slab stays solid)', () => {
    setLayerLookup({ 'so-layer': { visible: false } });
    const scene = new THREE.Scene();
    new BimSceneLayer(scene).sync(makeEntities());

    const args = slabToMesh.mock.calls[0];
    expect((args[1] as unknown[]).length).toBe(0);
  });
});
