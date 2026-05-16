/**
 * ADR-358 Phase 5a — `useStairTool` hook state machine.
 */
import { act, renderHook } from '@testing-library/react';
import { useStairTool } from '../useStairTool';
import type { StairEntity } from '../../../types/stair';

describe('useStairTool state machine (Phase 5a)', () => {
  it('1. initial state is idle until activate()', () => {
    const { result } = renderHook(() => useStairTool());
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.isActive).toBe(false);
    act(() => { result.current.activate(); });
    expect(result.current.state.phase).toBe('awaitingBasePoint');
    expect(result.current.isActive).toBe(true);
    expect(result.current.isAwaitingBasePoint).toBe(true);
  });

  it('2. click 1 → awaitingDirection + basePoint stored', () => {
    const { result } = renderHook(() => useStairTool());
    act(() => { result.current.activate(); });
    act(() => { result.current.onCanvasClick({ x: 50, y: 80 }); });
    expect(result.current.state.phase).toBe('awaitingDirection');
    expect(result.current.state.basePoint).toEqual({ x: 50, y: 80 });
    expect(result.current.state.direction).toBeNull();
  });

  it('3. click 2 → confirming + direction computed', () => {
    const { result } = renderHook(() => useStairTool());
    act(() => { result.current.activate(); });
    act(() => { result.current.onCanvasClick({ x: 0, y: 0 }); });
    act(() => { result.current.onCanvasClick({ x: 100, y: 0 }); });
    expect(result.current.state.phase).toBe('confirming');
    expect(result.current.state.direction).toBeCloseTo(0, 6);
    expect(result.current.isConfirming).toBe(true);
  });

  it('4. reset from any phase → awaitingBasePoint (or idle when inactive)', () => {
    const { result } = renderHook(() => useStairTool());
    act(() => { result.current.activate(); });
    act(() => { result.current.onCanvasClick({ x: 0, y: 0 }); });
    act(() => { result.current.reset(); });
    expect(result.current.state.phase).toBe('awaitingBasePoint');
    expect(result.current.state.basePoint).toBeNull();
    expect(result.current.state.direction).toBeNull();
  });

  it('5. confirm() from confirming → onStairCreated fires with StairEntity', () => {
    const created: StairEntity[] = [];
    const { result } = renderHook(() =>
      useStairTool({ onStairCreated: (e) => created.push(e), currentLevelId: 'L1' }),
    );
    act(() => { result.current.activate(); });
    act(() => { result.current.onCanvasClick({ x: 0, y: 0 }); });
    act(() => { result.current.onCanvasClick({ x: 100, y: 0 }); });
    act(() => { result.current.confirm(); });
    expect(created.length).toBe(1);
    const entity = created[0];
    expect(entity.type).toBe('stair');
    expect(entity.kind).toBe('straight');
    expect(entity.layer).toBe('L1');
    // tool resets to awaitingBasePoint for continuous chain
    expect(result.current.state.phase).toBe('awaitingBasePoint');
  });
});
