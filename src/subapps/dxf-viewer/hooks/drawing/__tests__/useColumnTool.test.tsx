/**
 * ADR-363 Phase 4 — `useColumnTool` state-machine tests.
 *
 * Coverage:
 *   - activate → 'awaitingPosition'
 *   - single click → onColumnCreated fires + remains in awaitingPosition (chain)
 *   - cycleAnchor advances through ANCHOR_CYCLE_ORDER
 *   - cycleAnchor(-1) reverses
 *   - setKind preserves anchor + overrides
 *   - deactivate → 'idle'
 *   - status text key changes per phase
 */

import { renderHook, act } from '@testing-library/react';
import { useColumnTool } from '../useColumnTool';
import {
  ANCHOR_CYCLE_ORDER,
  type ColumnEntity,
} from '../../../bim/types/column-types';

describe('useColumnTool', () => {
  it('initial state is idle until activated', () => {
    const { result } = renderHook(() => useColumnTool({ onColumnCreated: jest.fn() }));
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.isActive).toBe(false);
  });

  it('activate transitions to awaitingPosition', () => {
    const { result } = renderHook(() => useColumnTool({ onColumnCreated: jest.fn() }));
    act(() => result.current.activate());
    expect(result.current.state.phase).toBe('awaitingPosition');
    expect(result.current.isActive).toBe(true);
  });

  it('single click commits column and chains back to awaitingPosition', () => {
    const onColumnCreated = jest.fn();
    const { result } = renderHook(() => useColumnTool({ onColumnCreated }));
    act(() => result.current.activate());
    let committed = false;
    act(() => {
      committed = result.current.onCanvasClick({ x: 1000, y: 2000 });
    });
    expect(committed).toBe(true);
    expect(onColumnCreated).toHaveBeenCalledTimes(1);
    const entity = onColumnCreated.mock.calls[0][0] as ColumnEntity;
    expect(entity.type).toBe('column');
    expect(entity.kind).toBe('rectangular');
    expect(result.current.state.phase).toBe('awaitingPosition');
  });

  it('cycleAnchor advances forward through ANCHOR_CYCLE_ORDER', () => {
    const { result } = renderHook(() => useColumnTool({ onColumnCreated: jest.fn() }));
    act(() => result.current.activate());
    expect(result.current.state.anchor).toBe(ANCHOR_CYCLE_ORDER[0]);
    act(() => result.current.cycleAnchor());
    expect(result.current.state.anchor).toBe(ANCHOR_CYCLE_ORDER[1]);
    act(() => result.current.cycleAnchor());
    expect(result.current.state.anchor).toBe(ANCHOR_CYCLE_ORDER[2]);
  });

  it('cycleAnchor(-1) reverses', () => {
    const { result } = renderHook(() => useColumnTool({ onColumnCreated: jest.fn() }));
    act(() => result.current.activate());
    act(() => result.current.cycleAnchor(-1));
    expect(result.current.state.anchor).toBe(ANCHOR_CYCLE_ORDER[ANCHOR_CYCLE_ORDER.length - 1]);
  });

  it('setKind preserves anchor and overrides', () => {
    const { result } = renderHook(() => useColumnTool({ onColumnCreated: jest.fn() }));
    act(() => result.current.activate());
    act(() => result.current.setAnchor('nw'));
    act(() => result.current.setParamOverrides({ width: 500 }));
    act(() => result.current.setKind('circular'));
    expect(result.current.state.kind).toBe('circular');
    expect(result.current.state.anchor).toBe('nw');
    expect(result.current.state.overrides.width).toBe(500);
  });

  it('deactivate returns to idle', () => {
    const { result } = renderHook(() => useColumnTool({ onColumnCreated: jest.fn() }));
    act(() => result.current.activate());
    act(() => result.current.deactivate());
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.isActive).toBe(false);
  });

  it('status text key changes per phase', () => {
    const { result } = renderHook(() => useColumnTool({ onColumnCreated: jest.fn() }));
    expect(result.current.getStatusText()).toBe('');
    act(() => result.current.activate());
    expect(result.current.getStatusText()).toBe('tools.column.statusPosition');
  });
});
