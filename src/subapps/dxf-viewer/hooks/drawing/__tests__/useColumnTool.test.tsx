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

  // ────────────────────────────────────────────────────────────────────────
  // ADR-363 Phase 4.5c.1 — getGhostFootprints projection
  // ────────────────────────────────────────────────────────────────────────

  describe('getGhostFootprints (Phase 4.5c.1)', () => {
    it('returns null when phase=idle', () => {
      const { result } = renderHook(() => useColumnTool({ onColumnCreated: jest.fn() }));
      expect(result.current.getGhostFootprints({ x: 0, y: 0 })).toBeNull();
    });

    it('returns null when cursorPos=null even while awaitingPosition', () => {
      const { result } = renderHook(() => useColumnTool({ onColumnCreated: jest.fn() }));
      act(() => result.current.activate());
      expect(result.current.getGhostFootprints(null)).toBeNull();
    });

    it('returns 9 ghosts for rectangular awaitingPosition', () => {
      const { result } = renderHook(() => useColumnTool({ onColumnCreated: jest.fn() }));
      act(() => result.current.activate());
      const ghosts = result.current.getGhostFootprints({ x: 100, y: 200 });
      expect(ghosts).not.toBeNull();
      expect(ghosts!).toHaveLength(9);
    });

    it('returns 1 ghost for circular awaitingPosition', () => {
      const { result } = renderHook(() => useColumnTool({ onColumnCreated: jest.fn() }));
      act(() => result.current.setKind('circular'));
      act(() => result.current.activate());
      const ghosts = result.current.getGhostFootprints({ x: 0, y: 0 });
      expect(ghosts).not.toBeNull();
      expect(ghosts!).toHaveLength(1);
      expect(ghosts![0].anchor).toBe('center');
    });

    it('active ghost matches state.anchor after setAnchor', () => {
      const { result } = renderHook(() => useColumnTool({ onColumnCreated: jest.fn() }));
      act(() => result.current.activate());
      act(() => result.current.setAnchor('se'));
      const ghosts = result.current.getGhostFootprints({ x: 0, y: 0 });
      const active = ghosts!.filter((g) => g.isActive);
      expect(active).toHaveLength(1);
      expect(active[0].anchor).toBe('se');
    });

    it('active ghost rotates through ANCHOR_CYCLE_ORDER after cycleAnchor', () => {
      const { result } = renderHook(() => useColumnTool({ onColumnCreated: jest.fn() }));
      act(() => result.current.activate());
      act(() => result.current.cycleAnchor());
      act(() => result.current.cycleAnchor());
      const ghosts = result.current.getGhostFootprints({ x: 0, y: 0 });
      const active = ghosts!.find((g) => g.isActive);
      expect(active!.anchor).toBe(ANCHOR_CYCLE_ORDER[2]);
    });

    it('propagates ribbon overrides (width/depth) σε όλα τα ghosts', () => {
      const { result } = renderHook(() => useColumnTool({ onColumnCreated: jest.fn() }));
      act(() => result.current.activate());
      act(() => result.current.setParamOverrides({ width: 800, depth: 600 }));
      const ghosts = result.current.getGhostFootprints({ x: 0, y: 0 });
      for (const g of ghosts!) {
        const xs = g.footprint.vertices.map((v) => v.x);
        const ys = g.footprint.vertices.map((v) => v.y);
        const w = Math.max(...xs) - Math.min(...xs);
        const d = Math.max(...ys) - Math.min(...ys);
        expect(w).toBeCloseTo(800, 3);
        expect(d).toBeCloseTo(600, 3);
      }
    });

    it('returns null μετά από deactivate', () => {
      const { result } = renderHook(() => useColumnTool({ onColumnCreated: jest.fn() }));
      act(() => result.current.activate());
      act(() => result.current.deactivate());
      expect(result.current.getGhostFootprints({ x: 0, y: 0 })).toBeNull();
    });
  });
});
