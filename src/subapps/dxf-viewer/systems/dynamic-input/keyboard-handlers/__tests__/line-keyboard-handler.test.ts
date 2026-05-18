/**
 * Unit tests — line-keyboard-handler (ADR-357 Phase 2a).
 *
 * Covers:
 *   - Tab 2-cycle (Length → Angle → Length) per ADR §5.1.
 *   - Tab jump from stale X/Y state into the 2-cycle.
 *   - Enter on Length with empty value → no-op (does not advance).
 *   - Enter on Length alone (no Angle) → unlocks + focuses Angle.
 *   - Enter on Angle with Length+Angle → dispatches `add-point` with
 *     `coordinates = firstClickPoint + (length·cos(θ), length·sin(θ))`.
 *   - Submit guarded when firstClickPoint is null.
 */

import { handleLineKeyboard } from '../line-keyboard-handler';
import type {
  KeyboardHandlerContext,
  KeyboardHandlerActions,
  KeyboardHandlerRefs,
} from '../types';

const FAKE_REF = (): { current: null } => ({ current: null });

function makeRefs(): KeyboardHandlerRefs {
  return {
    xInputRef: FAKE_REF(),
    yInputRef: FAKE_REF(),
    angleInputRef: FAKE_REF(),
    lengthInputRef: FAKE_REF(),
    radiusInputRef: FAKE_REF(),
    diameterInputRef: FAKE_REF(),
    riseInputRef: FAKE_REF(),
    treadInputRef: FAKE_REF(),
    widthInputRef: FAKE_REF(),
    drawingPhaseRef: { current: 'second-point' },
  } as unknown as KeyboardHandlerRefs;
}

function makeContext(over: Partial<KeyboardHandlerContext> = {}): KeyboardHandlerContext {
  return {
    xValue: '',
    yValue: '',
    angleValue: '',
    lengthValue: '',
    radiusValue: '',
    diameterValue: '',
    riseValue: '',
    treadValue: '',
    widthValue: '',
    activeField: 'length',
    activeStairField: 'rise',
    drawingPhase: 'second-point',
    firstClickPoint: { x: 10, y: 20 },
    activeTool: 'line',
    normalizeNumber: (v: string) => v.replace(',', '.'),
    isValidNumber: (v: string) => !Number.isNaN(parseFloat(v)),
    ...over,
  };
}

function makeActions(): KeyboardHandlerActions & { _calls: Record<string, unknown[]> } {
  const calls: Record<string, unknown[]> = {};
  const record = (name: string) => (...args: unknown[]) => {
    (calls[name] ||= []).push(args.length === 1 ? args[0] : args);
  };
  return {
    setActiveField: record('setActiveField') as KeyboardHandlerActions['setActiveField'],
    setFieldUnlocked: record('setFieldUnlocked') as KeyboardHandlerActions['setFieldUnlocked'],
    setDrawingPhase: record('setDrawingPhase') as KeyboardHandlerActions['setDrawingPhase'],
    setIsCoordinateAnchored: record('setIsCoordinateAnchored') as KeyboardHandlerActions['setIsCoordinateAnchored'],
    setIsManualInput: record('setIsManualInput') as KeyboardHandlerActions['setIsManualInput'],
    setXValue: record('setXValue') as KeyboardHandlerActions['setXValue'],
    setYValue: record('setYValue') as KeyboardHandlerActions['setYValue'],
    setAngleValue: record('setAngleValue') as KeyboardHandlerActions['setAngleValue'],
    setLengthValue: record('setLengthValue') as KeyboardHandlerActions['setLengthValue'],
    setRadiusValue: record('setRadiusValue') as KeyboardHandlerActions['setRadiusValue'],
    setDiameterValue: record('setDiameterValue') as KeyboardHandlerActions['setDiameterValue'],
    setShowInput: record('setShowInput') as KeyboardHandlerActions['setShowInput'],
    setRiseValue: record('setRiseValue') as KeyboardHandlerActions['setRiseValue'],
    setTreadValue: record('setTreadValue') as KeyboardHandlerActions['setTreadValue'],
    setWidthValue: record('setWidthValue') as KeyboardHandlerActions['setWidthValue'],
    setActiveStairField: record('setActiveStairField') as KeyboardHandlerActions['setActiveStairField'],
    setFirstClickPoint: record('setFirstClickPoint') as KeyboardHandlerActions['setFirstClickPoint'],
    dispatchDynamicSubmit: ((detail) => {
      (calls.dispatchDynamicSubmit ||= []).push(detail);
      return new CustomEvent('dynamic-input-coordinate-submit', { detail });
    }) as KeyboardHandlerActions['dispatchDynamicSubmit'],
    resetForNextPointFirstPhase: record('resetForNextPointFirstPhase') as KeyboardHandlerActions['resetForNextPointFirstPhase'],
    CADFeedback: {
      onError: record('onError') as () => void,
      onInputConfirm: record('onInputConfirm') as () => void,
    },
    focusSoon: record('focusSoon') as KeyboardHandlerActions['focusSoon'],
    focusAndSelect: record('focusAndSelect') as KeyboardHandlerActions['focusAndSelect'],
    _calls: calls,
  };
}

const FAKE_KEY = new KeyboardEvent('keydown');

describe('line-keyboard-handler — Tab 2-cycle (ADR-357 §5.1)', () => {
  it('Tab from Length → Angle', () => {
    const ctx = makeContext({ activeField: 'length' });
    const acts = makeActions();
    const handled = handleLineKeyboard(FAKE_KEY, 'Tab', ctx, acts, makeRefs());
    expect(handled).toBe(true);
    expect(acts._calls.setActiveField).toEqual(['angle']);
  });

  it('Tab from Angle → Length', () => {
    const ctx = makeContext({ activeField: 'angle' });
    const acts = makeActions();
    const handled = handleLineKeyboard(FAKE_KEY, 'Tab', ctx, acts, makeRefs());
    expect(handled).toBe(true);
    expect(acts._calls.setActiveField).toEqual(['length']);
  });

  it('Tab from stale X jumps into Length (no X/Y in cycle)', () => {
    const ctx = makeContext({ activeField: 'x' });
    const acts = makeActions();
    const handled = handleLineKeyboard(FAKE_KEY, 'Tab', ctx, acts, makeRefs());
    expect(handled).toBe(true);
    expect(acts._calls.setActiveField).toEqual(['length']);
  });
});

describe('line-keyboard-handler — Enter submit path', () => {
  it('Enter on empty Length → no-op', () => {
    const ctx = makeContext({ activeField: 'length', lengthValue: '' });
    const acts = makeActions();
    const handled = handleLineKeyboard(FAKE_KEY, 'Enter', ctx, acts, makeRefs());
    expect(handled).toBe(false);
    expect(acts._calls.dispatchDynamicSubmit).toBeUndefined();
  });

  it('Enter on Length with no Angle yet → advance to Angle', () => {
    const ctx = makeContext({ activeField: 'length', lengthValue: '100', angleValue: '' });
    const acts = makeActions();
    const handled = handleLineKeyboard(FAKE_KEY, 'Enter', ctx, acts, makeRefs());
    expect(handled).toBe(true);
    expect(acts._calls.setActiveField).toEqual(['angle']);
    expect(acts._calls.dispatchDynamicSubmit).toBeUndefined();
  });

  it('Enter on Angle with Length+Angle → dispatch add-point with computed coordinates', () => {
    const ctx = makeContext({
      activeField: 'angle',
      lengthValue: '100',
      angleValue: '0',
      firstClickPoint: { x: 5, y: 7 },
    });
    const acts = makeActions();
    const handled = handleLineKeyboard(FAKE_KEY, 'Enter', ctx, acts, makeRefs());
    expect(handled).toBe(true);
    const submitted = acts._calls.dispatchDynamicSubmit?.[0] as
      | { tool: string; action: string; coordinates: { x: number; y: number } }
      | undefined;
    expect(submitted).toBeDefined();
    expect(submitted!.tool).toBe('line');
    expect(submitted!.action).toBe('add-point');
    expect(submitted!.coordinates.x).toBeCloseTo(105);
    expect(submitted!.coordinates.y).toBeCloseTo(7);
  });

  it('Enter on Angle at 90° produces +Y vector from anchor', () => {
    const ctx = makeContext({
      activeField: 'angle',
      lengthValue: '50',
      angleValue: '90',
      firstClickPoint: { x: 0, y: 0 },
    });
    const acts = makeActions();
    handleLineKeyboard(FAKE_KEY, 'Enter', ctx, acts, makeRefs());
    const submitted = acts._calls.dispatchDynamicSubmit?.[0] as { coordinates: { x: number; y: number } };
    expect(submitted.coordinates.x).toBeCloseTo(0);
    expect(submitted.coordinates.y).toBeCloseTo(50);
  });

  it('Submit guarded when firstClickPoint is null', () => {
    const ctx = makeContext({
      activeField: 'angle',
      lengthValue: '100',
      angleValue: '45',
      firstClickPoint: null,
    });
    const acts = makeActions();
    const handled = handleLineKeyboard(FAKE_KEY, 'Enter', ctx, acts, makeRefs());
    expect(handled).toBe(true);
    expect(acts._calls.dispatchDynamicSubmit).toBeUndefined();
    expect(acts._calls.onError).toBeDefined();
  });
});
