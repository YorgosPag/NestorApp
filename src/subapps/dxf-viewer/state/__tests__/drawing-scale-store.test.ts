import { act } from '@testing-library/react';
import {
  useDrawingScaleStore,
  DEFAULT_DRAWING_SCALE,
  DRAWING_SCALE_MIN,
  DRAWING_SCALE_MAX,
  DRAWING_SCALE_PRESETS,
} from '../drawing-scale-store';

beforeEach(() => {
  useDrawingScaleStore.getState().resetDrawingScale();
});

describe('drawingScaleStore', () => {
  it('defaults to 100', () => {
    expect(useDrawingScaleStore.getState().drawingScale).toBe(DEFAULT_DRAWING_SCALE);
  });

  it('sets a valid scale', () => {
    act(() => useDrawingScaleStore.getState().setDrawingScale(50));
    expect(useDrawingScaleStore.getState().drawingScale).toBe(50);
  });

  it('clamps below minimum to 1', () => {
    act(() => useDrawingScaleStore.getState().setDrawingScale(0));
    expect(useDrawingScaleStore.getState().drawingScale).toBe(DRAWING_SCALE_MIN);
  });

  it('clamps above maximum to 10000', () => {
    act(() => useDrawingScaleStore.getState().setDrawingScale(99999));
    expect(useDrawingScaleStore.getState().drawingScale).toBe(DRAWING_SCALE_MAX);
  });

  it('rounds fractional input', () => {
    act(() => useDrawingScaleStore.getState().setDrawingScale(33.7));
    expect(useDrawingScaleStore.getState().drawingScale).toBe(34);
  });

  it('resets to default', () => {
    act(() => useDrawingScaleStore.getState().setDrawingScale(200));
    act(() => useDrawingScaleStore.getState().resetDrawingScale());
    expect(useDrawingScaleStore.getState().drawingScale).toBe(DEFAULT_DRAWING_SCALE);
  });

  it('accepts all six preset values', () => {
    for (const preset of DRAWING_SCALE_PRESETS) {
      act(() => useDrawingScaleStore.getState().setDrawingScale(preset));
      expect(useDrawingScaleStore.getState().drawingScale).toBe(preset);
    }
  });

  it('accepts boundary values', () => {
    act(() => useDrawingScaleStore.getState().setDrawingScale(DRAWING_SCALE_MIN));
    expect(useDrawingScaleStore.getState().drawingScale).toBe(1);

    act(() => useDrawingScaleStore.getState().setDrawingScale(DRAWING_SCALE_MAX));
    expect(useDrawingScaleStore.getState().drawingScale).toBe(10000);
  });

  it('getState() is usable outside React (renderer pattern)', () => {
    act(() => useDrawingScaleStore.getState().setDrawingScale(500));
    const scale = useDrawingScaleStore.getState().drawingScale;
    expect(scale).toBe(500);
  });
});
