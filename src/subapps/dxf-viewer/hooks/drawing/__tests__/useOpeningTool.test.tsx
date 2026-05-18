/**
 * ADR-363 Phase 2 — useOpeningTool state-machine tests.
 *
 * Covers the canonical 2-state placement flow:
 *   - activate → 'awaitingHostWall'
 *   - click on wall → 'awaitingPosition' (hostWallId locked)
 *   - click again → commit → onOpeningCreated fires + back to 'awaitingHostWall'
 *   - host wall lookup miss → stays in 'awaitingHostWall' with error
 *   - setKind resets FSM but preserves kind
 *   - reset returns to 'awaitingHostWall' (kind + overrides preserved)
 *   - deactivate returns to 'idle'
 */

import { renderHook, act } from '@testing-library/react';
import { useOpeningTool } from '../useOpeningTool';
import { computeWallGeometry } from '../../../bim/geometry/wall-geometry';
import type { WallEntity, WallParams } from '../../../bim/types/wall-types';
import type { OpeningEntity } from '../../../bim/types/opening-types';

function makeWall(id = 'wall_test', overrides?: Partial<WallParams>): WallEntity {
  const params: WallParams = {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 5000, y: 0, z: 0 },
    height: 3000,
    thickness: 500,
    flip: false,
    ...overrides,
  };
  return {
    id,
    type: 'wall',
    kind: 'straight',
    layerId: '0',
    params,
    geometry: computeWallGeometry(params, 'straight'),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as WallEntity;
}

interface Harness {
  readonly wall: WallEntity;
  readonly onOpeningCreated: jest.Mock;
}

function makeHarness(): Harness {
  return { wall: makeWall(), onOpeningCreated: jest.fn() };
}

describe('useOpeningTool', () => {
  it('initial state is idle until activated', () => {
    const { wall, onOpeningCreated } = makeHarness();
    const { result } = renderHook(() =>
      useOpeningTool({
        onOpeningCreated,
        getWallById: () => wall,
        getWallAtPoint: () => wall,
      }),
    );
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.isActive).toBe(false);
  });

  it('activate transitions to awaitingHostWall', () => {
    const { wall, onOpeningCreated } = makeHarness();
    const { result } = renderHook(() =>
      useOpeningTool({
        onOpeningCreated,
        getWallById: () => wall,
        getWallAtPoint: () => wall,
      }),
    );
    act(() => result.current.activate());
    expect(result.current.state.phase).toBe('awaitingHostWall');
    expect(result.current.isActive).toBe(true);
  });

  it('host-wall click moves to awaitingPosition and locks hostWallId', () => {
    const { wall, onOpeningCreated } = makeHarness();
    const { result } = renderHook(() =>
      useOpeningTool({
        onOpeningCreated,
        getWallById: () => wall,
        getWallAtPoint: () => wall,
      }),
    );
    act(() => result.current.activate());
    act(() => {
      result.current.onCanvasClick({ x: 2000, y: 0 });
    });
    expect(result.current.state.phase).toBe('awaitingPosition');
    expect(result.current.state.hostWallId).toBe(wall.id);
  });

  it('click with no wall under cursor stays in awaitingHostWall + sets error', () => {
    const onOpeningCreated = jest.fn();
    const { result } = renderHook(() =>
      useOpeningTool({
        onOpeningCreated,
        getWallById: () => null,
        getWallAtPoint: () => null, // no wall found
      }),
    );
    act(() => result.current.activate());
    act(() => {
      result.current.onCanvasClick({ x: 9999, y: 9999 });
    });
    expect(result.current.state.phase).toBe('awaitingHostWall');
    expect(result.current.state.error).toBeTruthy();
    expect(onOpeningCreated).not.toHaveBeenCalled();
  });

  it('second click commits, fires onOpeningCreated, and chains back to awaitingHostWall', () => {
    const { wall, onOpeningCreated } = makeHarness();
    const { result } = renderHook(() =>
      useOpeningTool({
        onOpeningCreated,
        getWallById: () => wall,
        getWallAtPoint: () => wall,
      }),
    );
    act(() => result.current.activate());
    act(() => {
      result.current.onCanvasClick({ x: 1000, y: 0 });
    });
    act(() => {
      result.current.onCanvasClick({ x: 2000, y: 0 });
    });
    expect(onOpeningCreated).toHaveBeenCalledTimes(1);
    const entity = onOpeningCreated.mock.calls[0][0] as OpeningEntity;
    expect(entity.type).toBe('opening');
    expect(entity.params.wallId).toBe(wall.id);
    expect(entity.params.kind).toBe('door');
    // Continuous chain: back to awaitingHostWall, hostWallId cleared.
    expect(result.current.state.phase).toBe('awaitingHostWall');
    expect(result.current.state.hostWallId).toBeNull();
  });

  it('setKind preserves kind across FSM reset', () => {
    const { wall, onOpeningCreated } = makeHarness();
    const { result } = renderHook(() =>
      useOpeningTool({
        onOpeningCreated,
        getWallById: () => wall,
        getWallAtPoint: () => wall,
      }),
    );
    act(() => result.current.activate());
    act(() => result.current.setKind('window'));
    expect(result.current.state.kind).toBe('window');
    expect(result.current.state.phase).toBe('awaitingHostWall');
  });

  it('reset restores awaitingHostWall but preserves kind', () => {
    const { wall, onOpeningCreated } = makeHarness();
    const { result } = renderHook(() =>
      useOpeningTool({
        onOpeningCreated,
        getWallById: () => wall,
        getWallAtPoint: () => wall,
      }),
    );
    act(() => result.current.activate());
    act(() => result.current.setKind('sliding-door'));
    act(() => {
      result.current.onCanvasClick({ x: 1000, y: 0 });
    });
    expect(result.current.state.phase).toBe('awaitingPosition');
    act(() => result.current.reset());
    expect(result.current.state.phase).toBe('awaitingHostWall');
    expect(result.current.state.kind).toBe('sliding-door');
    expect(result.current.state.hostWallId).toBeNull();
  });

  it('deactivate returns to idle', () => {
    const { wall, onOpeningCreated } = makeHarness();
    const { result } = renderHook(() =>
      useOpeningTool({
        onOpeningCreated,
        getWallById: () => wall,
        getWallAtPoint: () => wall,
      }),
    );
    act(() => result.current.activate());
    act(() => result.current.deactivate());
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.isActive).toBe(false);
  });

  it('status text key changes per phase', () => {
    const { wall, onOpeningCreated } = makeHarness();
    const { result } = renderHook(() =>
      useOpeningTool({
        onOpeningCreated,
        getWallById: () => wall,
        getWallAtPoint: () => wall,
      }),
    );
    expect(result.current.getStatusText()).toBe('');
    act(() => result.current.activate());
    expect(result.current.getStatusText()).toBe('tools.opening.statusHostWall');
    act(() => {
      result.current.onCanvasClick({ x: 1000, y: 0 });
    });
    expect(result.current.getStatusText()).toBe('tools.opening.statusPosition');
  });
});
