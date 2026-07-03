/**
 * ADR-363 §column-polygon-sketch — `usePolygonSketchChain` FSM tests.
 *
 * Canonical vertex-chain primitive (κοινό sketch engine slab + κολώνα). Coverage
 * mirror του `useSlabTool.test` ώστε να κατοχυρώνεται ότι η εξαγωγή διατηρεί ΑΚΡΙΒΩΣ
 * τη συμπεριφορά:
 *   - activate → awaitingFirstVertex
 *   - first click → awaitingNextVertex (1 vertex)
 *   - subsequent clicks accumulate
 *   - finishPolygon με ≥minVertices → onCommit + back to awaitingFirstVertex
 *   - finishPolygon με <minVertices → no-op
 *   - auto-close κοντά στην πρώτη κορυφή → commit
 *   - onCommit=false (validator reject) → μένει σε awaitingNextVertex
 *   - deactivate → idle
 *   - custom minVertices
 */

import { renderHook, act } from '@testing-library/react';
import { usePolygonSketchChain } from '../use-polygon-sketch-chain';

describe('usePolygonSketchChain', () => {
  it('is idle until activated', () => {
    const { result } = renderHook(() => usePolygonSketchChain({ onCommit: () => true }));
    expect(result.current.phase).toBe('idle');
    expect(result.current.isActive).toBe(false);
  });

  it('activate → awaitingFirstVertex', () => {
    const { result } = renderHook(() => usePolygonSketchChain({ onCommit: () => true }));
    act(() => result.current.activate());
    expect(result.current.phase).toBe('awaitingFirstVertex');
    expect(result.current.isActive).toBe(true);
  });

  it('first click stores vertex + moves to awaitingNextVertex', () => {
    const { result } = renderHook(() => usePolygonSketchChain({ onCommit: () => true }));
    act(() => result.current.activate());
    act(() => {
      result.current.onCanvasClick({ x: 0, y: 0 });
    });
    expect(result.current.phase).toBe('awaitingNextVertex');
    expect(result.current.vertices).toHaveLength(1);
  });

  it('subsequent clicks accumulate vertices', () => {
    const { result } = renderHook(() => usePolygonSketchChain({ onCommit: () => true }));
    act(() => result.current.activate());
    act(() => result.current.onCanvasClick({ x: 0, y: 0 }));
    act(() => result.current.onCanvasClick({ x: 4000, y: 0 }));
    act(() => result.current.onCanvasClick({ x: 4000, y: 4000 }));
    expect(result.current.vertices).toHaveLength(3);
  });

  it('finishPolygon με ≥3 vertices commits + chains back to awaitingFirstVertex', () => {
    const onCommit = jest.fn(() => true);
    const { result } = renderHook(() => usePolygonSketchChain({ onCommit }));
    act(() => result.current.activate());
    act(() => result.current.onCanvasClick({ x: 0, y: 0 }));
    act(() => result.current.onCanvasClick({ x: 4000, y: 0 }));
    act(() => result.current.onCanvasClick({ x: 4000, y: 4000 }));
    let committed = false;
    act(() => {
      committed = result.current.finishPolygon();
    });
    expect(committed).toBe(true);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0]).toHaveLength(3);
    expect(result.current.phase).toBe('awaitingFirstVertex');
    expect(result.current.vertices).toHaveLength(0);
  });

  it('finishPolygon με < 3 vertices is a no-op', () => {
    const onCommit = jest.fn(() => true);
    const { result } = renderHook(() => usePolygonSketchChain({ onCommit }));
    act(() => result.current.activate());
    act(() => result.current.onCanvasClick({ x: 0, y: 0 }));
    act(() => result.current.onCanvasClick({ x: 1000, y: 0 }));
    let committed = false;
    act(() => {
      committed = result.current.finishPolygon();
    });
    expect(committed).toBe(false);
    expect(onCommit).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('awaitingNextVertex');
  });

  it('auto-close: click κοντά στην πρώτη κορυφή commits', () => {
    const onCommit = jest.fn(() => true);
    const { result } = renderHook(() =>
      usePolygonSketchChain({ onCommit, getAutoCloseTolerance: () => 50 }),
    );
    act(() => result.current.activate());
    act(() => result.current.onCanvasClick({ x: 0, y: 0 }));
    act(() => result.current.onCanvasClick({ x: 4000, y: 0 }));
    act(() => result.current.onCanvasClick({ x: 4000, y: 4000 }));
    act(() => result.current.onCanvasClick({ x: 10, y: 10 })); // within 50 of first
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('awaitingFirstVertex');
  });

  it('onCommit=false (validator reject) keeps awaitingNextVertex', () => {
    const onCommit = jest.fn(() => false);
    const { result } = renderHook(() => usePolygonSketchChain({ onCommit }));
    act(() => result.current.activate());
    act(() => result.current.onCanvasClick({ x: 0, y: 0 }));
    act(() => result.current.onCanvasClick({ x: 4000, y: 0 }));
    act(() => result.current.onCanvasClick({ x: 4000, y: 4000 }));
    let committed = false;
    act(() => {
      committed = result.current.finishPolygon();
    });
    expect(committed).toBe(false);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('awaitingNextVertex'); // vertices retained
    expect(result.current.vertices).toHaveLength(3);
  });

  it('deactivate → idle', () => {
    const { result } = renderHook(() => usePolygonSketchChain({ onCommit: () => true }));
    act(() => result.current.activate());
    act(() => result.current.deactivate());
    expect(result.current.phase).toBe('idle');
    expect(result.current.isActive).toBe(false);
  });

  it('honours custom minVertices (4 → 3 clicks cannot close)', () => {
    const onCommit = jest.fn(() => true);
    const { result } = renderHook(() => usePolygonSketchChain({ onCommit, minVertices: 4 }));
    act(() => result.current.activate());
    act(() => result.current.onCanvasClick({ x: 0, y: 0 }));
    act(() => result.current.onCanvasClick({ x: 4000, y: 0 }));
    act(() => result.current.onCanvasClick({ x: 4000, y: 4000 }));
    let committed = false;
    act(() => {
      committed = result.current.finishPolygon();
    });
    expect(committed).toBe(false);
    expect(onCommit).not.toHaveBeenCalled();
  });
});
