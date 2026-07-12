/**
 * ADR-641 Φ2 — useEffectiveLevelScene: the canvas's exclusive-render-scope scene source.
 *
 * Proves that entering / exiting the Block Editor (via the real ActiveBlockEditStore) flips the
 * returned scene between the raw world scene and the entered block's block-local synthetic scene —
 * a LOW-freq leaf subscription, no world SceneStore mutation. `useLevelScene` is mocked so the test
 * controls the raw scene in isolation.
 */

import { renderHook, act } from '@testing-library/react';
import { useEffectiveLevelScene } from '../useEffectiveLevelScene';
import { enterBlockEdit, exitBlockEdit } from '../ActiveBlockEditStore';
import { useLevelScene } from '../../scene/useSceneSelectors';
import type { BlockEntity, Entity, SceneLayer } from '../../../types/entities';
import type { SceneModel } from '../../../types/scene';

jest.mock('../../scene/useSceneSelectors', () => ({
  useLevelScene: jest.fn(),
}));

const mockedUseLevelScene = useLevelScene as jest.MockedFunction<typeof useLevelScene>;

const layer = (id: string): SceneLayer =>
  ({ id, name: 'L', color: '#fff', visible: true, locked: false } as SceneLayer);

const line = (id: string, sx: number, sy: number, ex: number, ey: number): Entity =>
  ({ id, type: 'line', layerId: 'lyr1', start: { x: sx, y: sy }, end: { x: ex, y: ey } } as unknown as Entity);

const block = (): BlockEntity =>
  ({
    id: 'blk1', type: 'block', name: '*U2', layerId: 'lyr1', visible: true,
    position: { x: 5000, y: 9000 }, scale: { x: 3, y: 3 }, rotation: 90,
    entities: [line('m0', 0, 0, 10, 0), line('m1', 0, 0, 0, 20)],
  } as BlockEntity);

const worldScene = (): SceneModel =>
  ({
    entities: [line('w0', 0, 0, 1, 0), block()],
    layersById: { lyr1: layer('lyr1') },
    bounds: { min: { x: 0, y: 0 }, max: { x: 5010, y: 9020 } },
    units: 'mm',
  } as unknown as SceneModel);

describe('useEffectiveLevelScene', () => {
  beforeEach(() => {
    exitBlockEdit();
    mockedUseLevelScene.mockReset();
  });
  afterAll(() => exitBlockEdit());

  it('returns the raw world scene at the top level (no block entered)', () => {
    const scene = worldScene();
    mockedUseLevelScene.mockReturnValue(scene);
    const { result } = renderHook(() => useEffectiveLevelScene('level-1'));
    expect(result.current).toBe(scene);
  });

  it('flips to the block-local synthetic scene on enterBlockEdit, and back on exit', () => {
    mockedUseLevelScene.mockReturnValue(worldScene());
    const { result } = renderHook(() => useEffectiveLevelScene('level-1'));

    // Top level → world scene (has the world line + the block container).
    expect(result.current?.entities.some((e) => e.id === 'blk1')).toBe(true);

    act(() => enterBlockEdit('blk1', '*U2'));
    // Inside BEDIT → ONLY the block's members in local space, no container, no world entity.
    expect(result.current?.entities.map((e) => e.id).sort()).toEqual(['m0', 'm1']);
    expect(result.current?.bounds.max).toEqual({ x: 10, y: 20 });

    act(() => exitBlockEdit());
    expect(result.current?.entities.some((e) => e.id === 'blk1')).toBe(true);
    expect(result.current?.entities.some((e) => e.id === 'w0')).toBe(true);
  });

  it('falls back to the world scene when the entered id is not a block in this scene', () => {
    const scene = worldScene();
    mockedUseLevelScene.mockReturnValue(scene);
    const { result } = renderHook(() => useEffectiveLevelScene('level-1'));
    act(() => enterBlockEdit('ghost', 'gone'));
    expect(result.current).toBe(scene);
  });
});
