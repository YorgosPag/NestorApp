/**
 * ADR-363 Φ1G.5 Slice 2d — OpeningMoveGhost lifecycle tests.
 *
 * Verifies the scene-leaf contract: showFor builds via the geometry + mesh SSoT and
 * adds a non-pickable group to the scene; a degenerate build hides (no add); hide
 * toggles visibility; dispose removes the group + frees the material. The geometry +
 * mesh builders are mocked; the focus is the ghost's scene lifecycle.
 */

import * as THREE from 'three';

const mockComputeGeometry = jest.fn(() => ({ position: { x: 1, y: 2 }, rotation: 0 }));
let mockMesh: THREE.Group | null = null;
const mockBuild = jest.fn(() => mockMesh);

jest.mock('../../../bim/geometry/opening-geometry', () => ({ computeOpeningGeometry: (...a: unknown[]) => mockComputeGeometry(...(a as [])) }));
jest.mock('../../converters/opening-mesh', () => ({ buildOpeningMesh: (...a: unknown[]) => mockBuild(...(a as [])) }));

import { OpeningMoveGhost } from '../OpeningMoveGhost';

const opening = { id: 'op-1', params: { wallId: 'wall-1', width: 900 } } as never;
const host = { id: 'wall-1', params: { sceneUnits: 'mm' } } as never;
const params = { wallId: 'wall-1', offsetFromStart: 300, width: 900 } as never;

function makeGroup(): THREE.Group {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
  return group;
}

describe('OpeningMoveGhost', () => {
  beforeEach(() => {
    mockComputeGeometry.mockClear();
    mockBuild.mockClear();
    mockMesh = makeGroup();
  });

  it('showFor builds via the SSoT and adds a group to the scene', () => {
    const scene = new THREE.Scene();
    const ghost = new OpeningMoveGhost(scene);
    ghost.showFor(opening, params, host, 0, 0);
    expect(mockComputeGeometry).toHaveBeenCalled();
    expect(mockBuild).toHaveBeenCalled();
    expect(scene.children).toContain(mockMesh);
  });

  it('makes the ghost group non-pickable (tags stripped, raycast disabled)', () => {
    const scene = new THREE.Scene();
    const ghost = new OpeningMoveGhost(scene);
    ghost.showFor(opening, params, host, 0, 0);
    const mesh = mockMesh!.children[0] as THREE.Mesh;
    expect(mesh.userData['bimId']).toBeUndefined();
    expect(mesh.raycast()).toBeUndefined();
  });

  it('a degenerate build (null) hides — nothing added', () => {
    mockMesh = null;
    const scene = new THREE.Scene();
    const ghost = new OpeningMoveGhost(scene);
    ghost.showFor(opening, params, host, 0, 0);
    expect(scene.children).toHaveLength(0);
  });

  it('showFor replaces the previous group (only the latest is in the scene)', () => {
    const scene = new THREE.Scene();
    const ghost = new OpeningMoveGhost(scene);
    const first = mockMesh!;
    ghost.showFor(opening, params, host, 0, 0);
    mockMesh = makeGroup();
    ghost.showFor(opening, params, host, 0, 0);
    expect(scene.children).not.toContain(first);
    expect(scene.children).toContain(mockMesh);
    expect(scene.children).toHaveLength(1);
  });

  it('hide toggles visibility without removing', () => {
    const scene = new THREE.Scene();
    const ghost = new OpeningMoveGhost(scene);
    ghost.showFor(opening, params, host, 0, 0);
    ghost.hide();
    expect(mockMesh!.visible).toBe(false);
    expect(scene.children).toContain(mockMesh);
  });

  it('dispose removes the group from the scene', () => {
    const scene = new THREE.Scene();
    const ghost = new OpeningMoveGhost(scene);
    ghost.showFor(opening, params, host, 0, 0);
    ghost.dispose();
    expect(scene.children).toHaveLength(0);
  });
});
