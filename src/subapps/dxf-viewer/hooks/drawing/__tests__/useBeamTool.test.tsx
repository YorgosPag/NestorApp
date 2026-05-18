/**
 * ADR-363 Phase 5 — `useBeamTool` state-machine tests.
 *
 * Coverage:
 *   - initial idle state until activate
 *   - straight kind: 2-click commit + chain back to awaitingStart
 *   - curved kind: 3-click commit (start → end → control) + chain
 *   - cantilever kind: 2-click commit (same FSM as straight)
 *   - setKind preserves overrides + resets FSM
 *   - status text key changes per phase
 *   - deactivate returns to idle
 */

import { renderHook, act } from '@testing-library/react';
import { useBeamTool } from '../useBeamTool';
import type { BeamEntity } from '../../../bim/types/beam-types';

describe('useBeamTool', () => {
  it('initial state is idle until activated', () => {
    const { result } = renderHook(() => useBeamTool({ onBeamCreated: jest.fn() }));
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.isActive).toBe(false);
  });

  it('activate transitions to awaitingStart', () => {
    const { result } = renderHook(() => useBeamTool({ onBeamCreated: jest.fn() }));
    act(() => result.current.activate());
    expect(result.current.state.phase).toBe('awaitingStart');
    expect(result.current.isActive).toBe(true);
  });

  it('straight kind: 2-click commit + chain back to awaitingStart', () => {
    const onBeamCreated = jest.fn();
    const { result } = renderHook(() => useBeamTool({ onBeamCreated }));
    act(() => result.current.activate());
    act(() => { result.current.onCanvasClick({ x: 0, y: 0 }); });
    expect(result.current.state.phase).toBe('awaitingEnd');
    let committed = false;
    act(() => {
      committed = result.current.onCanvasClick({ x: 5000, y: 0 });
    });
    expect(committed).toBe(true);
    expect(onBeamCreated).toHaveBeenCalledTimes(1);
    const entity = onBeamCreated.mock.calls[0][0] as BeamEntity;
    expect(entity.type).toBe('beam');
    expect(entity.kind).toBe('straight');
    expect(result.current.state.phase).toBe('awaitingStart');
  });

  it('curved kind: 3-click commit (start → end → curveControl)', () => {
    const onBeamCreated = jest.fn();
    const { result } = renderHook(() => useBeamTool({ onBeamCreated }));
    act(() => result.current.activate());
    act(() => result.current.setKind('curved'));
    act(() => { result.current.onCanvasClick({ x: 0, y: 0 }); });
    expect(result.current.state.phase).toBe('awaitingEnd');
    act(() => { result.current.onCanvasClick({ x: 5000, y: 0 }); });
    expect(result.current.state.phase).toBe('awaitingCurveControl');
    let committed = false;
    act(() => {
      committed = result.current.onCanvasClick({ x: 2500, y: 1500 });
    });
    expect(committed).toBe(true);
    expect(onBeamCreated).toHaveBeenCalledTimes(1);
    const entity = onBeamCreated.mock.calls[0][0] as BeamEntity;
    expect(entity.kind).toBe('curved');
    expect(entity.params.curveControl).toBeDefined();
    expect(result.current.state.phase).toBe('awaitingStart');
  });

  it('cantilever kind: 2-click commit (same FSM as straight)', () => {
    const onBeamCreated = jest.fn();
    const { result } = renderHook(() => useBeamTool({ onBeamCreated }));
    act(() => result.current.activate());
    act(() => result.current.setKind('cantilever'));
    act(() => { result.current.onCanvasClick({ x: 0, y: 0 }); });
    act(() => { result.current.onCanvasClick({ x: 3000, y: 0 }); });
    expect(onBeamCreated).toHaveBeenCalledTimes(1);
    const entity = onBeamCreated.mock.calls[0][0] as BeamEntity;
    expect(entity.kind).toBe('cantilever');
  });

  it('setKind preserves overrides + resets FSM to awaitingStart', () => {
    const { result } = renderHook(() => useBeamTool({ onBeamCreated: jest.fn() }));
    act(() => result.current.activate());
    act(() => result.current.setParamOverrides({ width: 300 }));
    act(() => result.current.setKind('curved'));
    expect(result.current.state.kind).toBe('curved');
    expect(result.current.state.overrides.width).toBe(300);
    expect(result.current.state.phase).toBe('awaitingStart');
  });

  it('status text key changes per phase', () => {
    const { result } = renderHook(() => useBeamTool({ onBeamCreated: jest.fn() }));
    act(() => result.current.activate());
    expect(result.current.getStatusText()).toBe('tools.beam.statusStart');
    act(() => { result.current.onCanvasClick({ x: 0, y: 0 }); });
    expect(result.current.getStatusText()).toBe('tools.beam.statusEnd');
  });

  it('deactivate returns to idle', () => {
    const { result } = renderHook(() => useBeamTool({ onBeamCreated: jest.fn() }));
    act(() => result.current.activate());
    act(() => result.current.deactivate());
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.isActive).toBe(false);
  });
});
