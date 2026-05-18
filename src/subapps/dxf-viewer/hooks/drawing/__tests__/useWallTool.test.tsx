/**
 * ADR-363 Phase 1B — useWallTool state-machine tests.
 *
 * Covers the canonical 2-click placement flow:
 *   - activate → 'awaitingStart'
 *   - click 1 → 'awaitingEnd' (startPoint stamped)
 *   - click 2 → commit → onWallCreated fires + back to 'awaitingStart'
 *   - reset clears startPoint
 *   - deactivate returns to 'idle'
 *
 * Validator hardErrors (e.g. zero-length wall) MUST not propagate as a commit
 * — the tool stays in `awaitingEnd` and surfaces `state.error`.
 */

import { renderHook, act } from '@testing-library/react';
import { useWallTool } from '../useWallTool';
import type { WallEntity } from '../../../bim/types/wall-types';

describe('useWallTool', () => {
  it('initial state is idle until activated', () => {
    const { result } = renderHook(() => useWallTool());
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.isActive).toBe(false);
  });

  it('activate transitions to awaitingStart', () => {
    const { result } = renderHook(() => useWallTool());
    act(() => result.current.activate());
    expect(result.current.state.phase).toBe('awaitingStart');
    expect(result.current.isActive).toBe(true);
  });

  it('first click moves to awaitingEnd and stamps startPoint', () => {
    const { result } = renderHook(() => useWallTool());
    act(() => result.current.activate());
    act(() => {
      result.current.onCanvasClick({ x: 100, y: 200 });
    });
    expect(result.current.state.phase).toBe('awaitingEnd');
    expect(result.current.state.startPoint).toEqual({ x: 100, y: 200 });
  });

  it('second click commits, fires onWallCreated, and chains back to awaitingStart', () => {
    const onWallCreated = jest.fn();
    const { result } = renderHook(() => useWallTool({ onWallCreated }));
    act(() => result.current.activate());
    act(() => {
      result.current.onCanvasClick({ x: 0, y: 0 });
    });
    act(() => {
      result.current.onCanvasClick({ x: 5000, y: 0 });
    });
    expect(onWallCreated).toHaveBeenCalledTimes(1);
    const entity = onWallCreated.mock.calls[0][0] as WallEntity;
    expect(entity.type).toBe('wall');
    expect(entity.kind).toBe('straight');
    expect(entity.params.start).toMatchObject({ x: 0, y: 0 });
    expect(entity.params.end).toMatchObject({ x: 5000, y: 0 });
    // Continuous chain: back to awaitingStart, startPoint cleared.
    expect(result.current.state.phase).toBe('awaitingStart');
    expect(result.current.state.startPoint).toBeNull();
  });

  it('zero-length wall fails validation — no commit, stays in awaitingEnd', () => {
    const onWallCreated = jest.fn();
    const { result } = renderHook(() => useWallTool({ onWallCreated }));
    act(() => result.current.activate());
    act(() => {
      result.current.onCanvasClick({ x: 0, y: 0 });
    });
    act(() => {
      // Same point → length 0 → validator hardError → no commit
      result.current.onCanvasClick({ x: 0, y: 0 });
    });
    expect(onWallCreated).not.toHaveBeenCalled();
    expect(result.current.state.phase).toBe('awaitingEnd');
    expect(result.current.state.error).toBeTruthy();
  });

  it('reset clears startPoint and returns to awaitingStart', () => {
    const { result } = renderHook(() => useWallTool());
    act(() => result.current.activate());
    act(() => {
      result.current.onCanvasClick({ x: 50, y: 50 });
    });
    act(() => result.current.reset());
    expect(result.current.state.phase).toBe('awaitingStart');
    expect(result.current.state.startPoint).toBeNull();
  });

  it('deactivate returns to idle', () => {
    const { result } = renderHook(() => useWallTool());
    act(() => result.current.activate());
    act(() => result.current.deactivate());
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.isActive).toBe(false);
  });

  it('setParamOverrides merges into state', () => {
    const { result } = renderHook(() => useWallTool());
    act(() => result.current.activate());
    act(() => result.current.setParamOverrides({ category: 'interior', height: 2700 }));
    expect(result.current.state.overrides.category).toBe('interior');
    expect(result.current.state.overrides.height).toBe(2700);
  });

  it('overrides flow through to created entity', () => {
    const onWallCreated = jest.fn();
    const { result } = renderHook(() => useWallTool({ onWallCreated }));
    act(() => result.current.activate());
    act(() => result.current.setParamOverrides({ category: 'partition' }));
    act(() => {
      result.current.onCanvasClick({ x: 0, y: 0 });
    });
    act(() => {
      result.current.onCanvasClick({ x: 3000, y: 0 });
    });
    const entity = onWallCreated.mock.calls[0][0] as WallEntity;
    expect(entity.params.category).toBe('partition');
  });

  it('click in idle phase is a no-op (does not advance machine)', () => {
    const { result } = renderHook(() => useWallTool());
    const ok = result.current.onCanvasClick({ x: 1, y: 1 });
    expect(ok).toBe(false);
    expect(result.current.state.phase).toBe('idle');
  });

  it('getStatusText returns i18n keys per phase', () => {
    const { result } = renderHook(() => useWallTool());
    expect(result.current.getStatusText()).toBe('');
    act(() => result.current.activate());
    expect(result.current.getStatusText()).toBe('tools.wall.statusStart');
    act(() => {
      result.current.onCanvasClick({ x: 0, y: 0 });
    });
    expect(result.current.getStatusText()).toBe('tools.wall.statusEnd');
  });

  // ─── ADR-363 Phase 1C — curved + polyline flows ────────────────────────

  it('setKind switches active wall kind and resets the phase', () => {
    const { result } = renderHook(() => useWallTool());
    act(() => result.current.activate());
    act(() => result.current.setKind('curved'));
    expect(result.current.state.kind).toBe('curved');
    expect(result.current.state.phase).toBe('awaitingStart');
  });

  it('curved kind: 3-click flow start → end → control → commit', () => {
    const onWallCreated = jest.fn();
    const { result } = renderHook(() => useWallTool({ onWallCreated }));
    act(() => result.current.activate());
    act(() => result.current.setKind('curved'));
    act(() => { result.current.onCanvasClick({ x: 0, y: 0 }); });
    expect(result.current.state.phase).toBe('awaitingEnd');
    act(() => { result.current.onCanvasClick({ x: 1000, y: 0 }); });
    expect(result.current.state.phase).toBe('awaitingCurveControl');
    act(() => { result.current.onCanvasClick({ x: 500, y: 300 }); });
    expect(onWallCreated).toHaveBeenCalledTimes(1);
    const entity = onWallCreated.mock.calls[0][0] as WallEntity;
    expect(entity.kind).toBe('curved');
    expect(entity.params.curveControl).toMatchObject({ x: 500, y: 300 });
  });

  it('polyline kind: N-click flow + finishPolyline commits', () => {
    const onWallCreated = jest.fn();
    const { result } = renderHook(() => useWallTool({ onWallCreated }));
    act(() => result.current.activate());
    act(() => result.current.setKind('polyline'));
    act(() => { result.current.onCanvasClick({ x: 0, y: 0 }); });
    expect(result.current.state.phase).toBe('awaitingNextVertex');
    act(() => { result.current.onCanvasClick({ x: 1000, y: 0 }); });
    act(() => { result.current.onCanvasClick({ x: 1500, y: 500 }); });
    act(() => { result.current.onCanvasClick({ x: 2000, y: 0 }); });
    expect(result.current.state.polylineVertices).toHaveLength(4);
    act(() => { result.current.finishPolyline(); });
    expect(onWallCreated).toHaveBeenCalledTimes(1);
    const entity = onWallCreated.mock.calls[0][0] as WallEntity;
    expect(entity.kind).toBe('polyline');
    expect(entity.params.polylineVertices).toHaveLength(4);
  });

  it('finishPolyline is a no-op for straight kind', () => {
    const onWallCreated = jest.fn();
    const { result } = renderHook(() => useWallTool({ onWallCreated }));
    act(() => result.current.activate());
    const ok = result.current.finishPolyline();
    expect(ok).toBe(false);
    expect(onWallCreated).not.toHaveBeenCalled();
  });
});
