/**
 * ADR-363 Phase 3 — `useSlabTool` state-machine tests.
 *
 * Coverage:
 *   - activate → 'awaitingFirstVertex'
 *   - first click → 'awaitingNextVertex' (1 vertex stored)
 *   - subsequent clicks accumulate vertices
 *   - finishPolygon με ≥3 vertices → onSlabCreated + back to 'awaitingFirstVertex'
 *   - finishPolygon με <3 vertices → no-op
 *   - auto-close: click κοντά στην πρώτη κορυφή με ≥3 vertices → commit
 *   - deactivate → 'idle'
 *   - setKind preserves kind across reset
 *   - status text key changes per phase
 */

import { renderHook, act } from '@testing-library/react';
import { useSlabTool } from '../useSlabTool';
import type { SlabEntity } from '../../../bim/types/slab-types';

describe('useSlabTool', () => {
  it('initial state is idle until activated', () => {
    const { result } = renderHook(() => useSlabTool({ onSlabCreated: jest.fn() }));
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.isActive).toBe(false);
  });

  it('activate transitions to awaitingFirstVertex', () => {
    const { result } = renderHook(() => useSlabTool({ onSlabCreated: jest.fn() }));
    act(() => result.current.activate());
    expect(result.current.state.phase).toBe('awaitingFirstVertex');
    expect(result.current.isActive).toBe(true);
  });

  it('first click stores vertex + moves to awaitingNextVertex', () => {
    const { result } = renderHook(() => useSlabTool({ onSlabCreated: jest.fn() }));
    act(() => result.current.activate());
    act(() => {
      result.current.onCanvasClick({ x: 0, y: 0 });
    });
    expect(result.current.state.phase).toBe('awaitingNextVertex');
    expect(result.current.state.vertices).toHaveLength(1);
  });

  it('subsequent clicks accumulate vertices', () => {
    const { result } = renderHook(() => useSlabTool({ onSlabCreated: jest.fn() }));
    act(() => result.current.activate());
    act(() => result.current.onCanvasClick({ x: 0, y: 0 }));
    act(() => result.current.onCanvasClick({ x: 4000, y: 0 }));
    act(() => result.current.onCanvasClick({ x: 4000, y: 4000 }));
    expect(result.current.state.vertices).toHaveLength(3);
  });

  it('finishPolygon with ≥3 vertices commits and chains back to awaitingFirstVertex', () => {
    const onSlabCreated = jest.fn();
    const { result } = renderHook(() => useSlabTool({ onSlabCreated }));
    act(() => result.current.activate());
    act(() => result.current.onCanvasClick({ x: 0, y: 0 }));
    act(() => result.current.onCanvasClick({ x: 4000, y: 0 }));
    act(() => result.current.onCanvasClick({ x: 4000, y: 4000 }));
    act(() => result.current.onCanvasClick({ x: 0, y: 4000 }));
    let committed = false;
    act(() => {
      committed = result.current.finishPolygon();
    });
    expect(committed).toBe(true);
    expect(onSlabCreated).toHaveBeenCalledTimes(1);
    const entity = onSlabCreated.mock.calls[0][0] as SlabEntity;
    expect(entity.type).toBe('slab');
    expect(entity.params.outline.vertices).toHaveLength(4);
    expect(result.current.state.phase).toBe('awaitingFirstVertex');
    expect(result.current.state.vertices).toHaveLength(0);
  });

  it('finishPolygon με < 3 vertices is a no-op', () => {
    const onSlabCreated = jest.fn();
    const { result } = renderHook(() => useSlabTool({ onSlabCreated }));
    act(() => result.current.activate());
    act(() => result.current.onCanvasClick({ x: 0, y: 0 }));
    act(() => result.current.onCanvasClick({ x: 1000, y: 0 }));
    let committed = false;
    act(() => {
      committed = result.current.finishPolygon();
    });
    expect(committed).toBe(false);
    expect(onSlabCreated).not.toHaveBeenCalled();
    expect(result.current.state.phase).toBe('awaitingNextVertex');
  });

  it('auto-close: click near first vertex με ≥3 vertices commits', () => {
    const onSlabCreated = jest.fn();
    const { result } = renderHook(() =>
      useSlabTool({ onSlabCreated, getAutoCloseTolerance: () => 50 }),
    );
    act(() => result.current.activate());
    act(() => result.current.onCanvasClick({ x: 0, y: 0 }));
    act(() => result.current.onCanvasClick({ x: 4000, y: 0 }));
    act(() => result.current.onCanvasClick({ x: 4000, y: 4000 }));
    // 4th click near first vertex (within 50mm tolerance) → auto-close.
    act(() => result.current.onCanvasClick({ x: 10, y: 10 }));
    expect(onSlabCreated).toHaveBeenCalledTimes(1);
    expect(result.current.state.phase).toBe('awaitingFirstVertex');
  });

  it('deactivate returns to idle', () => {
    const { result } = renderHook(() => useSlabTool({ onSlabCreated: jest.fn() }));
    act(() => result.current.activate());
    act(() => result.current.deactivate());
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.isActive).toBe(false);
  });

  it('setKind preserves kind across FSM transitions', () => {
    const { result } = renderHook(() => useSlabTool({ onSlabCreated: jest.fn() }));
    act(() => result.current.activate());
    act(() => result.current.setKind('roof'));
    expect(result.current.state.kind).toBe('roof');
    expect(result.current.state.phase).toBe('awaitingFirstVertex');
  });

  it('status text key changes per phase', () => {
    const { result } = renderHook(() => useSlabTool({ onSlabCreated: jest.fn() }));
    expect(result.current.getStatusText()).toBe('');
    act(() => result.current.activate());
    expect(result.current.getStatusText()).toBe('tools.slab.statusFirstVertex');
    act(() => result.current.onCanvasClick({ x: 0, y: 0 }));
    expect(result.current.getStatusText()).toBe('tools.slab.statusNextVertex');
  });
});
