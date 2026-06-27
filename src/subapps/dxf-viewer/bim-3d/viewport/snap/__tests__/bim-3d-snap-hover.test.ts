/**
 * bim-3d-snap-hover.test — the 3D snap-hover resolver reuses the ONE global snap engine and
 * returns the 2D-shared view-model + the surface elevation (ADR-542). These tests pin the
 * reuse contract: OSNAP-off / off-model / no-characteristic-point ⇒ null; a hit ⇒ the snapped
 * point's view at the front-most hit's elevation.
 */

import * as THREE from 'three';
import { computeSnap3DHover } from '../bim-3d-snap-hover';

// ── SSoT dependencies mocked at the seam (no real raycaster / camera / engine needed) ──
const mockRaycastWorldPoint = jest.fn();
const mockWorldToDxfPlan = jest.fn();
const mockFindSnapPoint = jest.fn();
const mockGetSettings = jest.fn();
const mockSyncViewport = jest.fn();

jest.mock('../../../systems/raycaster/BimEntityRaycaster', () => ({
  raycastWorldPoint: (...a: unknown[]) => mockRaycastWorldPoint(...a),
}));
jest.mock('../../coordinate-transforms', () => ({
  worldToDxfPlan: (...a: unknown[]) => mockWorldToDxfPlan(...a),
}));
jest.mock('../../../../snapping/global-snap-engine', () => ({
  getGlobalSnapEngine: () => ({
    getSettings: () => mockGetSettings(),
    findSnapPoint: (...a: unknown[]) => mockFindSnapPoint(...a),
  }),
}));
jest.mock('../../../animation/bim3d-edit-drag-snap', () => ({
  syncSnapEngineViewport3D: (...a: unknown[]) => mockSyncViewport(...a),
}));

const group = new THREE.Group();
const camera = new THREE.PerspectiveCamera();
const dom = {} as HTMLElement;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSettings.mockReturnValue({ enabled: true });
  mockWorldToDxfPlan.mockReturnValue({ x: 1000, y: 2000, z: 2700 });
});

describe('computeSnap3DHover — reuse of the global snap engine (ADR-542)', () => {
  it('returns null when OSNAP is disabled (never raycasts)', () => {
    mockGetSettings.mockReturnValue({ enabled: false });
    expect(computeSnap3DHover(group, camera, dom, 50, 50)).toBeNull();
    expect(mockRaycastWorldPoint).not.toHaveBeenCalled();
  });

  it('returns null when the cursor is off the model (raycast miss)', () => {
    mockRaycastWorldPoint.mockReturnValue(null);
    expect(computeSnap3DHover(group, camera, dom, 50, 50)).toBeNull();
    expect(mockFindSnapPoint).not.toHaveBeenCalled();
  });

  it('returns null when no characteristic point is in tolerance (found:false)', () => {
    mockRaycastWorldPoint.mockReturnValue(new THREE.Vector3(1, 2.7, -2));
    mockFindSnapPoint.mockReturnValue({ found: false, snapPoint: null });
    expect(computeSnap3DHover(group, camera, dom, 50, 50)).toBeNull();
  });

  it('queries the engine with the hit plan point and syncs the 3D viewport first', () => {
    const world = new THREE.Vector3(1, 2.7, -2);
    mockRaycastWorldPoint.mockReturnValue(world);
    mockFindSnapPoint.mockReturnValue({
      found: true,
      snappedPoint: { x: 1000, y: 2000 },
      activeMode: 'bim_corner',
      snapPoint: { description: 'bim-column-corner' },
    });

    computeSnap3DHover(group, camera, dom, 50, 50);

    expect(mockSyncViewport).toHaveBeenCalledTimes(1);
    expect(mockSyncViewport).toHaveBeenCalledWith(expect.anything(), camera, dom, world);
    expect(mockFindSnapPoint).toHaveBeenCalledWith({ x: 1000, y: 2000 });
  });

  it('maps a found snap to the 2D view-model + the front-most hit elevation', () => {
    mockRaycastWorldPoint.mockReturnValue(new THREE.Vector3(1, 2.7, -2));
    mockFindSnapPoint.mockReturnValue({
      found: true,
      snappedPoint: { x: 1000, y: 2000 },
      activeMode: 'bim_corner',
      snapPoint: { description: 'bim-column-corner' },
    });

    const marker = computeSnap3DHover(group, camera, dom, 50, 50);

    expect(marker).toEqual({
      view: { point: { x: 1000, y: 2000 }, type: 'bim_corner', description: 'bim-column-corner' },
      elevMm: 2700, // worldToDxfPlan(...).z — the surface the cursor points at
    });
  });
});
