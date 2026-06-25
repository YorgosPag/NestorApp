/**
 * ADR-040 cursor-lag Φ12.1 — HitTestingService.updateScene ref-equality guard.
 *
 * updateScene is called from the render loop on EVERY dirty frame (incl. every
 * hover-entity change). Before the guard it re-mapped ALL entities
 * (`convertDxfEntityToEntityModel`, O(n) allocation) + rebuilt the spatial index on
 * every hover → GC churn → cursor jank scaling with entity count (worst on Chrome).
 * The guard skips the rebuild when the (immutable) scene reference is unchanged, so the
 * index rebuilds ONLY on a real scene change. These tests lock that contract by counting
 * the O(n) per-entity conversion calls.
 */

import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';

jest.mock('../hit-test-entity-model', () => ({
  convertDxfEntityToEntityModel: jest.fn((e: unknown) => ({ ...(e as object) })),
}));

import { convertDxfEntityToEntityModel } from '../hit-test-entity-model';
import { HitTestingService } from '../HitTestingService';

const mockConvert = convertDxfEntityToEntityModel as jest.Mock;
const sceneOf = (...ids: string[]) =>
  ({ entities: ids.map((id) => ({ id, type: 'line' })) } as unknown as DxfScene);

beforeEach(() => mockConvert.mockClear());

describe('ADR-040 Φ12.1 — HitTestingService.updateScene ref guard', () => {
  it('rebuilds the index on a NEW scene reference (maps every entity once)', () => {
    const svc = new HitTestingService();
    svc.updateScene(sceneOf('a', 'b', 'c'));
    expect(mockConvert).toHaveBeenCalledTimes(3);
  });

  it('does NOT rebuild when the scene reference is unchanged (the per-hover hot path)', () => {
    const svc = new HitTestingService();
    const scene = sceneOf('a', 'b');
    svc.updateScene(scene);
    mockConvert.mockClear();
    // Simulate many render-loop frames during a hover sweep — same scene ref.
    svc.updateScene(scene);
    svc.updateScene(scene);
    svc.updateScene(scene);
    expect(mockConvert).not.toHaveBeenCalled();
  });

  it('rebuilds again when the scene reference actually changes (real mutation)', () => {
    const svc = new HitTestingService();
    svc.updateScene(sceneOf('a'));
    mockConvert.mockClear();
    svc.updateScene(sceneOf('a', 'b')); // new immutable scene object
    expect(mockConvert).toHaveBeenCalledTimes(2);
  });

  it('transitions to empty on null scene, then rebuilds on the next real scene', () => {
    const svc = new HitTestingService();
    const scene = sceneOf('a');
    svc.updateScene(scene);
    mockConvert.mockClear();
    svc.updateScene(null);        // ref changed → empty branch, no per-entity map
    expect(mockConvert).not.toHaveBeenCalled();
    svc.updateScene(sceneOf('a', 'b')); // real scene again → rebuild
    expect(mockConvert).toHaveBeenCalledTimes(2);
  });
});
