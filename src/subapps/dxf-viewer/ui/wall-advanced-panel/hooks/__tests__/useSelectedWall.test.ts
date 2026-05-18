/**
 * ADR-363 Phase 1D — `useSelectedWall` tests.
 *
 * Verifies the pure derivation contract: returns the wall when the primary
 * selection matches a wall entity in the scene, returns null otherwise.
 */

import { renderHook } from '@testing-library/react';
import { useSelectedWall } from '../useSelectedWall';
import type { SceneModel } from '../../../../types/scene';
import type { WallEntity } from '../../../../bim/types/wall-types';

const wallEntity: WallEntity = {
  id: 'wall-1',
  type: 'wall',
  kind: 'straight',
  layerId: '0',
  params: {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 1000, y: 0, z: 0 },
    height: 3000,
    thickness: 250,
    flip: false,
  },
  geometry: {
    axisPolyline: { points: [] },
    outerEdge: { points: [] },
    innerEdge: { points: [] },
    bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
    length: 1,
    area: 3,
    volume: 0.75,
  },
  validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null as never },
  visible: true,
} as WallEntity;

const otherEntity = { id: 'line-9', type: 'line' } as never;

const scene = (entities: readonly unknown[]): SceneModel =>
  ({ entities, layers: [], colors: [] }) as unknown as SceneModel;

describe('useSelectedWall (ADR-363 Phase 1D)', () => {
  it('1. returns the wall when the selection matches', () => {
    const { result } = renderHook(() =>
      useSelectedWall('wall-1', scene([wallEntity])),
    );
    expect(result.current?.id).toBe('wall-1');
  });

  it('2. returns null when the selection is not a wall', () => {
    const { result } = renderHook(() =>
      useSelectedWall('line-9', scene([wallEntity, otherEntity])),
    );
    expect(result.current).toBeNull();
  });

  it('3. returns null when the scene is null', () => {
    const { result } = renderHook(() => useSelectedWall('wall-1', null));
    expect(result.current).toBeNull();
  });

  it('4. returns null when no primary selection', () => {
    const { result } = renderHook(() =>
      useSelectedWall(null, scene([wallEntity])),
    );
    expect(result.current).toBeNull();
  });
});
