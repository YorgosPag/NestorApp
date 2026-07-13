/**
 * ADR-646 Φ4 #6 — Contract tests for the Scale tool contextual-tab bridge.
 *
 * Drives `ScaleToolStore` directly (the bridge is self-contained, no props) and
 * asserts the three surfaces: factor commit (via the hook-registered sink), the
 * Copy / Non-uniform toggles (incl. the sub-phase transition), and the Reference
 * action. Also pins the compose-safety no-op for foreign keys.
 */

import { renderHook, act } from '@testing-library/react';
import { useRibbonScaleToolBridge } from '../useRibbonScaleToolBridge';
import { ScaleToolStore } from '../../../../systems/scale/ScaleToolStore';
import { SCALE_TOOL_RIBBON_KEYS } from '../bridge/scale-tool-command-keys';

describe('useRibbonScaleToolBridge', () => {
  beforeEach(() => {
    ScaleToolStore.reset();
    ScaleToolStore.setCommitSink(null);
  });

  it('factor combobox commits a uniform scale through the registered sink', () => {
    const sink = jest.fn();
    ScaleToolStore.setCommitSink(sink);
    const { result } = renderHook(() => useRibbonScaleToolBridge());

    act(() => result.current.onComboboxChange(SCALE_TOOL_RIBBON_KEYS.factor, '2'));
    expect(sink).toHaveBeenCalledWith(2, 2);

    act(() => result.current.onComboboxChange(SCALE_TOOL_RIBBON_KEYS.factor, '-0.5'));
    expect(sink).toHaveBeenLastCalledWith(-0.5, -0.5);
  });

  it('factor combobox rejects zero / NaN (no commit)', () => {
    const sink = jest.fn();
    ScaleToolStore.setCommitSink(sink);
    const { result } = renderHook(() => useRibbonScaleToolBridge());

    act(() => result.current.onComboboxChange(SCALE_TOOL_RIBBON_KEYS.factor, '0'));
    act(() => result.current.onComboboxChange(SCALE_TOOL_RIBBON_KEYS.factor, 'abc'));
    expect(sink).not.toHaveBeenCalled();
  });

  it('factor combobox value shows the typed buffer, else the last factor', () => {
    const { result } = renderHook(() => useRibbonScaleToolBridge());
    expect(result.current.getComboboxState(SCALE_TOOL_RIBBON_KEYS.factor)?.value).toBe('1');

    act(() => { ScaleToolStore.appendBuffer('3'); ScaleToolStore.appendBuffer('.'); ScaleToolStore.appendBuffer('5'); });
    expect(result.current.getComboboxState(SCALE_TOOL_RIBBON_KEYS.factor)?.value).toBe('3.5');
  });

  it('Copy toggle reads and writes copyMode', () => {
    const { result } = renderHook(() => useRibbonScaleToolBridge());
    expect(result.current.getToggleState(SCALE_TOOL_RIBBON_KEYS.toggles.copy)).toBe(false);

    act(() => result.current.onToggle(SCALE_TOOL_RIBBON_KEYS.toggles.copy, true));
    expect(ScaleToolStore.getState().copyMode).toBe(true);
    expect(result.current.getToggleState(SCALE_TOOL_RIBBON_KEYS.toggles.copy)).toBe(true);
  });

  it('Non-uniform toggle transitions the direct sub-phase mid-operation', () => {
    ScaleToolStore.setBasePoint({ x: 0, y: 0 });
    ScaleToolStore.setPhase('scale_input', 'direct');
    const { result } = renderHook(() => useRibbonScaleToolBridge());

    act(() => result.current.onToggle(SCALE_TOOL_RIBBON_KEYS.toggles.nonUniform, true));
    expect(ScaleToolStore.getState().nonUniformMode).toBe(true);
    expect(ScaleToolStore.getState().subPhase).toBe('direct_x');

    act(() => result.current.onToggle(SCALE_TOOL_RIBBON_KEYS.toggles.nonUniform, false));
    expect(ScaleToolStore.getState().nonUniformMode).toBe(false);
    expect(ScaleToolStore.getState().subPhase).toBe('direct');
  });

  it('Non-uniform toggle only sets the flag when not yet in scale_input (armed pre-start)', () => {
    ScaleToolStore.setPhase('base_point');
    const { result } = renderHook(() => useRibbonScaleToolBridge());

    act(() => result.current.onToggle(SCALE_TOOL_RIBBON_KEYS.toggles.nonUniform, true));
    expect(ScaleToolStore.getState().nonUniformMode).toBe(true);
    expect(ScaleToolStore.getState().phase).toBe('base_point'); // unchanged
  });

  it('Reference action moves to the reference-pick sub-phase (only in scale_input)', () => {
    const { result } = renderHook(() => useRibbonScaleToolBridge());

    // Not in scale_input → no-op.
    act(() => { ScaleToolStore.setPhase('base_point'); });
    act(() => result.current.onAction(SCALE_TOOL_RIBBON_KEYS.actions.reference));
    expect(ScaleToolStore.getState().subPhase).not.toBe('ref_p1_x');

    // In scale_input/direct → ref_p1_x.
    act(() => { ScaleToolStore.setPhase('scale_input', 'direct'); });
    act(() => result.current.onAction(SCALE_TOOL_RIBBON_KEYS.actions.reference));
    expect(ScaleToolStore.getState().subPhase).toBe('ref_p1_x');

    // On the Y axis → ref_p1_y.
    act(() => { ScaleToolStore.setPhase('scale_input', 'direct_y'); });
    act(() => result.current.onAction(SCALE_TOOL_RIBBON_KEYS.actions.reference));
    expect(ScaleToolStore.getState().subPhase).toBe('ref_p1_y');
  });

  it('no-ops for keys owned by other bridges (composition safety)', () => {
    const sink = jest.fn();
    ScaleToolStore.setCommitSink(sink);
    const { result } = renderHook(() => useRibbonScaleToolBridge());

    expect(result.current.getComboboxState('array.params.rows')).toBeNull();
    expect(result.current.getToggleState('array.toggles.pathReversed')).toBe(false);
    act(() => {
      result.current.onComboboxChange('array.params.rows', '5');
      result.current.onToggle('wall.toggles.something', true);
      result.current.onAction('array.actions.close');
    });
    expect(sink).not.toHaveBeenCalled();
    expect(ScaleToolStore.getState().copyMode).toBe(false);
  });
});
