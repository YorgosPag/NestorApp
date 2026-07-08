/**
 * ADR-600 — Tests for the single-click placement tool factory
 * (`createSingleClickPlacementTool`).
 *
 * A synthetic entity/params drives the invariant FSM so the behaviours every one
 * of the 8 migrated tools inherits are pinned once:
 *   • activate → awaitingPosition; onCanvasClick commits (onCreated + returns true
 *     + stays awaiting for the continuous chain); click while idle is a no-op;
 *   • buildEntity failure surfaces `hardErrors[0]` on state.error and returns false;
 *   • getGhostFootprint is gated on awaitingPosition + cursor, and both commit and
 *     ghost route through `resolveCommitOverrides` (extra state merged in);
 *   • deactivate resets to initial (extra included); reset keeps overrides+extra;
 *   • the `useExtension` API is spread into the result and can patch extra state;
 *   • `place3dEvent` routes an EventBus placement to the same commit path.
 */

import { renderHook, act } from '@testing-library/react';
import { EventBus } from '../../../systems/events/EventBus';
import {
  createSingleClickPlacementTool,
  type PlacementBuildResult,
} from '../create-single-click-placement-tool';

interface FakeOverrides {
  readonly size?: number;
  readonly tag?: string;
}
interface FakeParams {
  readonly x: number;
  readonly overrides: FakeOverrides;
  readonly units: string;
}
interface FakeEntity {
  readonly id: string;
  readonly params: FakeParams;
  readonly levelId: string;
}

function buildParams(pt: { x: number; y: number }, overrides: FakeOverrides, units: string): FakeParams {
  return { x: pt.x, overrides, units };
}
function buildEntity(params: FakeParams, levelId: string): PlacementBuildResult<FakeEntity> {
  if (params.overrides.tag === 'bad') return { ok: false, hardErrors: ['too-bad', 'ignored'] };
  return { ok: true, entity: { id: 'fake', params, levelId } };
}

const useFakeTool = createSingleClickPlacementTool<
  FakeEntity,
  FakeParams,
  FakeOverrides,
  { tag: string },
  { setTag(tag: string): void },
  'mm' | 'm'
>({
  defaultSceneUnits: 'mm',
  initialExtra: { tag: 'default' },
  buildParams,
  buildEntity,
  computeFootprint: (params) => [{ x: params.x, y: 0, z: params.overrides.tag === 'default' ? 0 : 9 }],
  resolveCommitOverrides: (s) => ({ ...s.overrides, tag: s.tag }),
  place3dEvent: 'bim:place-furniture-3d',
  getStatusText: (s) => (s.phase === 'awaitingPosition' ? 'status.await' : ''),
  useExtension: ({ setState }) => ({
    setTag: (tag: string) => setState((prev) => ({ ...prev, tag, error: null })),
  }),
});

const CURSOR = { x: 42, y: 7 };

describe('ADR-600 — createSingleClickPlacementTool FSM', () => {
  it('starts idle and ignores clicks until activated', () => {
    const onCreated = jest.fn();
    const { result } = renderHook(() => useFakeTool({ onCreated }));
    expect(result.current.isActive).toBe(false);
    expect(result.current.isAwaitingPosition).toBe(false);
    let committed = true;
    act(() => { committed = result.current.onCanvasClick(CURSOR); });
    expect(committed).toBe(false);
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('activate → awaitingPosition, and a click commits + stays awaiting (continuous)', () => {
    const onCreated = jest.fn();
    const { result } = renderHook(() => useFakeTool({ onCreated, currentLevelId: 'L2' }));
    act(() => result.current.activate());
    expect(result.current.isAwaitingPosition).toBe(true);
    expect(result.current.getStatusText()).toBe('status.await');

    let committed = false;
    act(() => { committed = result.current.onCanvasClick(CURSOR); });
    expect(committed).toBe(true);
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onCreated.mock.calls[0][0]).toMatchObject({ id: 'fake', levelId: 'L2' });
    // Continuous chain: still awaiting after a commit.
    expect(result.current.isAwaitingPosition).toBe(true);
  });

  it('surfaces buildEntity hardErrors[0] and returns false on a bad commit', () => {
    const onCreated = jest.fn();
    const { result } = renderHook(() => useFakeTool({ onCreated }));
    act(() => result.current.activate());
    act(() => result.current.setTag('bad'));
    let committed = true;
    act(() => { committed = result.current.onCanvasClick(CURSOR); });
    expect(committed).toBe(false);
    expect(onCreated).not.toHaveBeenCalled();
    expect(result.current.state.error).toBe('too-bad');
  });

  it('routes commit + ghost through resolveCommitOverrides (extra state merged in)', () => {
    const onCreated = jest.fn<void, [FakeEntity]>();
    const { result } = renderHook(() => useFakeTool({ onCreated }));
    // Ghost null when idle / cursor null.
    expect(result.current.getGhostFootprint(CURSOR)).toBeNull();
    act(() => result.current.activate());
    expect(result.current.getGhostFootprint(null)).toBeNull();
    // default tag → z 0; changing extra state flows into the ghost params.
    expect(result.current.getGhostFootprint(CURSOR)).toEqual([{ x: 42, y: 0, z: 0 }]);
    act(() => result.current.setTag('custom'));
    expect(result.current.getGhostFootprint(CURSOR)).toEqual([{ x: 42, y: 0, z: 9 }]);
    // Commit carries the merged tag through resolveCommitOverrides.
    act(() => { result.current.onCanvasClick(CURSOR); });
    expect(onCreated.mock.calls[0][0].params.overrides.tag).toBe('custom');
  });

  it('deactivate resets extra to initial; reset keeps overrides + extra', () => {
    const { result } = renderHook(() => useFakeTool({}));
    act(() => result.current.activate());
    act(() => { result.current.setParamOverrides({ size: 5 }); result.current.setTag('keep'); });
    act(() => result.current.reset());
    expect(result.current.isAwaitingPosition).toBe(true); // reset keeps active
    expect(result.current.state.overrides.size).toBe(5);
    expect(result.current.state.tag).toBe('keep');
    act(() => result.current.deactivate());
    expect(result.current.isActive).toBe(false);
    expect(result.current.state.tag).toBe('default'); // back to initialExtra
    expect(result.current.state.overrides).toEqual({});
  });

  it('place3dEvent routes an EventBus placement to the same commit path', () => {
    const onCreated = jest.fn();
    const { result } = renderHook(() => useFakeTool({ onCreated }));
    act(() => result.current.activate());
    act(() => { EventBus.emit('bim:place-furniture-3d', { point: CURSOR }); });
    expect(onCreated).toHaveBeenCalledTimes(1);
  });
});
