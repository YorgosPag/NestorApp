import { act } from '@testing-library/react';

// B.2: drawing-scale-store re-exports bim-render-settings-store which
// transitively imports the Firestore service. Mock it to keep this
// unit test focused on drawing-scale behavior only.
jest.mock('../../services/bim-render-settings.service', () => ({
  saveBimRenderSettings: jest.fn().mockResolvedValue(undefined),
}));

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

// ADR-375 Phase B.4 — fit-to-paper auto-fit + manual-override guard.
describe('applyAutoDrawingScale (Phase B.4)', () => {
  it('applies the auto scale when the user has not set one manually', () => {
    act(() => useDrawingScaleStore.getState().applyAutoDrawingScale(50));
    expect(useDrawingScaleStore.getState().drawingScale).toBe(50);
    // Auto must NOT lock further auto-fits.
    expect(useDrawingScaleStore.getState().drawingScaleUserSet).toBe(false);
  });

  it('is ignored once the user set the scale manually', () => {
    act(() => useDrawingScaleStore.getState().setDrawingScale(20)); // manual lock
    act(() => useDrawingScaleStore.getState().applyAutoDrawingScale(200));
    expect(useDrawingScaleStore.getState().drawingScale).toBe(20); // unchanged
  });

  it('force overrides the manual lock (explicit «Fit» button)', () => {
    act(() => useDrawingScaleStore.getState().setDrawingScale(20)); // manual lock
    act(() => useDrawingScaleStore.getState().applyAutoDrawingScale(200, { force: true }));
    expect(useDrawingScaleStore.getState().drawingScale).toBe(200);
    // Force does not re-lock — auto stays live afterwards.
    act(() => useDrawingScaleStore.getState().applyAutoDrawingScale(50));
    expect(useDrawingScaleStore.getState().drawingScale).toBe(50);
  });

  it('resetDrawingScale clears the manual lock', () => {
    act(() => useDrawingScaleStore.getState().setDrawingScale(20)); // manual lock
    act(() => useDrawingScaleStore.getState().resetDrawingScale());
    act(() => useDrawingScaleStore.getState().applyAutoDrawingScale(200));
    expect(useDrawingScaleStore.getState().drawingScale).toBe(200); // auto runs again
  });
});

// ADR-739 §20.8 — the manual lock must OUTLIVE the tab.
//
// It was runtime-only until then, so the guarantee its own doc comment promised
// ("a genuine re-import never overwrites a scale the user deliberately chose")
// evaporated on every reload: the flag came back `false` and the next auto pass
// was free to replace a hand-picked 1:100 with a bounds-derived 1:5000.
describe('drawingScaleUserSet is PERSISTED per level (§20.8)', () => {
  const LEVEL = 'lvl_test';

  // The store writes through a 500 ms debounce (`DXF_TIMING.persist.SETTINGS`);
  // fake timers let the payload assertions flush it deterministically.
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('resolves ABSENT (pre-§20.8 docs) as AUTO, not locked', () => {
    act(() => useDrawingScaleStore.getState().loadForLevel(LEVEL, { drawingScale: 250 }));
    expect(useDrawingScaleStore.getState().drawingScaleUserSet).toBe(false);
    // …and therefore an auto pass is still free to speak.
    act(() => useDrawingScaleStore.getState().applyAutoDrawingScale(50));
    expect(useDrawingScaleStore.getState().drawingScale).toBe(50);
  });

  it('restores a PERSISTED lock, so the auto pass stays silent after a reload', () => {
    act(() =>
      useDrawingScaleStore.getState().loadForLevel(LEVEL, {
        drawingScale: 100,
        drawingScaleUserSet: true,
      }),
    );
    expect(useDrawingScaleStore.getState().drawingScaleUserSet).toBe(true);

    // THE REGRESSION: this is the reload-then-auto-fit path that ate the choice.
    act(() => useDrawingScaleStore.getState().applyAutoDrawingScale(5000));
    expect(useDrawingScaleStore.getState().drawingScale).toBe(100);
  });

  it('writes the lock to the persisted payload alongside the value it protects', () => {
    const { saveBimRenderSettings } = jest.requireMock(
      '../../services/bim-render-settings.service',
    ) as { saveBimRenderSettings: jest.Mock };

    act(() => useDrawingScaleStore.getState().loadForLevel(LEVEL, { drawingScale: 100 }));
    saveBimRenderSettings.mockClear();
    act(() => useDrawingScaleStore.getState().setDrawingScale(50));
    jest.advanceTimersByTime(2000); // flush the 500 ms debounce

    expect(saveBimRenderSettings).toHaveBeenCalled();
    const [, payload] = saveBimRenderSettings.mock.calls[saveBimRenderSettings.mock.calls.length - 1];
    // Persisting the value WITHOUT the lock is precisely the old bug.
    expect(payload).toMatchObject({ drawingScale: 50, drawingScaleUserSet: true });
  });

  it('an AUTO pass persists the UNLOCKED mode, so auto keeps working later', () => {
    const { saveBimRenderSettings } = jest.requireMock(
      '../../services/bim-render-settings.service',
    ) as { saveBimRenderSettings: jest.Mock };

    act(() => useDrawingScaleStore.getState().loadForLevel(LEVEL, { drawingScale: 100 }));
    saveBimRenderSettings.mockClear();
    act(() => useDrawingScaleStore.getState().applyAutoDrawingScale(200));
    jest.advanceTimersByTime(2000);

    const [, payload] = saveBimRenderSettings.mock.calls[saveBimRenderSettings.mock.calls.length - 1];
    expect(payload).toMatchObject({ drawingScale: 200, drawingScaleUserSet: false });
  });

  it('carries each level its OWN mode instead of leaking the previous one', () => {
    act(() =>
      useDrawingScaleStore.getState().loadForLevel('lvl_a', {
        drawingScale: 100,
        drawingScaleUserSet: true,
      }),
    );
    expect(useDrawingScaleStore.getState().drawingScaleUserSet).toBe(true);

    act(() => useDrawingScaleStore.getState().loadForLevel('lvl_b', { drawingScale: 100 }));
    expect(useDrawingScaleStore.getState().drawingScaleUserSet).toBe(false);
  });

  it('treats a truthy-but-not-boolean legacy value as AUTO (strict === true)', () => {
    act(() =>
      useDrawingScaleStore.getState().loadForLevel(LEVEL, {
        drawingScale: 100,
        drawingScaleUserSet: 1 as unknown as boolean,
      }),
    );
    expect(useDrawingScaleStore.getState().drawingScaleUserSet).toBe(false);
  });
});
