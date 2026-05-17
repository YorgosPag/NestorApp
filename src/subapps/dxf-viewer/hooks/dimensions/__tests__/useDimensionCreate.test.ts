/**
 * ADR-362 Phase D1 — useDimensionCreate hook integration tests.
 *
 * The hook is the only side-effect carrier in the creation flow:
 *   - Generates the real enterprise dim id (`dim_<UUID-v4>`) at commit.
 *   - Resolves the target layerId via the injected resolver.
 *   - Fires `onDimensionCreated` with the committed `DimensionEntity`.
 *   - Auto-restarts the flow with the cached params (continuous-mode loop).
 *
 * Covered here:
 *   - start('smart') dispatches `start` with mode='smart' + null override.
 *   - start('linear') dispatches `start` with mode='manual' + manualOverride.
 *   - onCursorMove / onClick / onKey route to the store unchanged.
 *   - Escape cancels + clears the cached start so no auto-restart fires.
 *   - 3-click linear path commits and immediately restarts in continuous mode.
 *   - Generated entity carries the resolved layerId + a `dim_`-prefixed id.
 */

import { act, renderHook } from '@testing-library/react';
import type { DimensionEntity } from '../../../types/dimension';
import {
  __resetDimensionCreateStoreForTests,
  dimensionCreateStore,
} from '../../../stores/DimensionCreateStore';
import { useDimensionCreate } from '../useDimensionCreate';

jest.mock('@/services/enterprise-id-convenience', () => ({
  generateDimensionId: jest.fn(() => 'dim_test-id-123'),
}));

const STYLE_ID = 'dimstyle_iso';

beforeEach(() => {
  __resetDimensionCreateStoreForTests();
});

afterEach(() => {
  __resetDimensionCreateStoreForTests();
});

function setup(onDimensionCreated = jest.fn<void, [DimensionEntity]>()) {
  const resolveLayerId = jest.fn<string, []>(() => 'lyr_default');
  const resolveStyleId = jest.fn<string, []>(() => STYLE_ID);
  const { result, unmount } = renderHook(() =>
    useDimensionCreate({
      onDimensionCreated,
      resolveLayerId,
      resolveStyleId,
    }),
  );
  return { api: result, onDimensionCreated, resolveLayerId, resolveStyleId, unmount };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('useDimensionCreate — dispatch surface', () => {
  it('start("smart") puts the store in smart mode with deferred currentType', () => {
    const { api } = setup();
    act(() => api.current.start('smart'));
    const state = dimensionCreateStore.get();
    expect(state.mode).toBe('smart');
    expect(state.status).toBe('collecting');
    expect(state.styleId).toBe(STYLE_ID);
    expect(state.currentType).toBeNull();
  });

  it('start("linear") pins manualOverride + currentType', () => {
    const { api } = setup();
    act(() => api.current.start('linear'));
    const state = dimensionCreateStore.get();
    expect(state.mode).toBe('manual');
    expect(state.manualOverride).toBe('linear');
    expect(state.currentType).toBe('linear');
  });

  it('onCursorMove updates the store cursor', () => {
    const { api } = setup();
    act(() => api.current.start('smart'));
    act(() => api.current.onCursorMove({ x: 42, y: 7 }));
    expect(dimensionCreateStore.get().cursorWorld).toEqual({ x: 42, y: 7 });
  });

  it('onClick appends a click record', () => {
    const { api } = setup();
    act(() => api.current.start('linear'));
    act(() => api.current.onClick({ x: 1, y: 2 }));
    const state = dimensionCreateStore.get();
    expect(state.clicks).toHaveLength(1);
    expect(state.clicks[0].world).toEqual({ x: 1, y: 2 });
  });

  it('onKey Tab / Space increment counters (smart mode)', () => {
    const { api } = setup();
    act(() => api.current.start('smart'));
    act(() => api.current.onKey('Tab'));
    act(() => api.current.onKey('Space'));
    act(() => api.current.onKey('Space'));
    const state = dimensionCreateStore.get();
    expect(state.tabPressCount).toBe(1);
    expect(state.spacePressCount).toBe(2);
  });

  it('onKey Escape cancels + prevents auto-restart on next commit', async () => {
    const onCreated = jest.fn<void, [DimensionEntity]>();
    const { api } = setup(onCreated);
    act(() => api.current.start('linear'));
    act(() => api.current.onKey('Escape'));
    expect(dimensionCreateStore.get().status).toBe('idle');

    // Subsequent 3 clicks should not fire commit because flow was cancelled.
    act(() => api.current.onClick({ x: 0, y: 0 }));
    act(() => api.current.onClick({ x: 1, y: 0 }));
    act(() => api.current.onClick({ x: 0, y: 1 }));
    await flushMicrotasks();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('cancel() resets the store + the cached start params', async () => {
    const onCreated = jest.fn<void, [DimensionEntity]>();
    const { api } = setup(onCreated);
    act(() => api.current.start('aligned'));
    act(() => api.current.cancel());
    expect(dimensionCreateStore.get().mode).toBeNull();
  });
});

describe('useDimensionCreate — commit + restart', () => {
  it('fires onDimensionCreated with the committed entity at the 3rd click', async () => {
    const onCreated = jest.fn<void, [DimensionEntity]>();
    const { api, resolveLayerId } = setup(onCreated);
    act(() => api.current.start('linear'));
    act(() => api.current.onClick({ x: 0, y: 0 }));
    act(() => api.current.onClick({ x: 100, y: 0 }));
    act(() => api.current.onClick({ x: 50, y: 30 }));

    await act(async () => {
      await flushMicrotasks();
    });

    expect(onCreated).toHaveBeenCalledTimes(1);
    const entity = onCreated.mock.calls[0][0];
    expect(entity.type).toBe('dimension');
    expect(entity.dimensionType).toBe('linear');
    expect(entity.id).toBe('dim_test-id-123');
    expect(entity.styleId).toBe(STYLE_ID);
    expect(entity.layerId).toBe('lyr_default');
    expect(entity.defPoints).toHaveLength(3);
    expect(resolveLayerId).toHaveBeenCalled();
  });

  it('auto-restarts in continuous mode with the cached start params', async () => {
    const onCreated = jest.fn<void, [DimensionEntity]>();
    const { api } = setup(onCreated);
    act(() => api.current.start('linear'));
    act(() => api.current.onClick({ x: 0, y: 0 }));
    act(() => api.current.onClick({ x: 100, y: 0 }));
    act(() => api.current.onClick({ x: 50, y: 30 }));

    await act(async () => {
      await flushMicrotasks();
    });

    const state = dimensionCreateStore.get();
    // Restart wipes clicks but keeps mode/styleId/manualOverride.
    expect(state.status).toBe('collecting');
    expect(state.clicks).toEqual([]);
    expect(state.mode).toBe('manual');
    expect(state.manualOverride).toBe('linear');
    expect(state.currentType).toBe('linear');
  });

  it('does not restart when the cached start has been cleared (cancel)', async () => {
    const onCreated = jest.fn<void, [DimensionEntity]>();
    const { api } = setup(onCreated);
    act(() => api.current.start('linear'));
    act(() => api.current.onClick({ x: 0, y: 0 }));
    act(() => api.current.onClick({ x: 100, y: 0 }));
    // Clear cache mid-flow.
    act(() => api.current.cancel());
    act(() => api.current.start('linear'));
    // Re-fire the flow to commit and observe the restart still uses the new cache.
    act(() => api.current.onClick({ x: 0, y: 0 }));
    act(() => api.current.onClick({ x: 100, y: 0 }));
    act(() => api.current.onClick({ x: 50, y: 30 }));
    await act(async () => {
      await flushMicrotasks();
    });
    expect(dimensionCreateStore.get().mode).toBe('manual');
  });
});

describe('useDimensionCreate — Phase D2 radial + ordinate end-to-end', () => {
  it('radius: 2 clicks (arc pick + text position) → committed RadiusDimensionEntity', async () => {
    const onCreated = jest.fn<void, [DimensionEntity]>();
    const { api } = setup(onCreated);
    const arcHover = {
      id: 'A1', type: 'arc', center: { x: 0, y: 0 }, radius: 50,
      startAngle: 0, endAngle: Math.PI / 2, layerId: 'L',
    } as const;
    act(() => api.current.start('radius'));
    act(() => api.current.onClick({ x: 50, y: 0 }, arcHover));
    act(() => api.current.onClick({ x: 100, y: 100 }));
    await act(async () => { await flushMicrotasks(); });
    expect(onCreated).toHaveBeenCalledTimes(1);
    const entity = onCreated.mock.calls[0][0];
    expect(entity.dimensionType).toBe('radius');
    expect(entity.defPoints).toHaveLength(2);
    expect(entity.defPoints[0]).toEqual({ x: 0, y: 0 }); // center derived from arc
  });

  it('ordinate: 2 free clicks → committed OrdinateDimensionEntity with auto axis + datum {0,0}', async () => {
    const onCreated = jest.fn<void, [DimensionEntity]>();
    const { api } = setup(onCreated);
    act(() => api.current.start('ordinate'));
    act(() => api.current.onClick({ x: 100, y: 50 }));
    act(() => api.current.onClick({ x: 300, y: 50 })); // horizontal leader
    await act(async () => { await flushMicrotasks(); });
    expect(onCreated).toHaveBeenCalledTimes(1);
    const entity = onCreated.mock.calls[0][0];
    expect(entity.dimensionType).toBe('ordinate');
    expect(entity.defPoints).toEqual([{ x: 100, y: 50 }]);
    // axis 'y' because |Δx|=200 > |Δy|=0.
    expect((entity as { axis?: string }).axis).toBe('y');
    expect((entity as { datum?: { x: number; y: number } }).datum).toEqual({ x: 0, y: 0 });
  });

  it('manual dim-radius silently swallows clicks until the cursor is over a valid arc/circle', async () => {
    const onCreated = jest.fn<void, [DimensionEntity]>();
    const { api } = setup(onCreated);
    act(() => api.current.start('radius'));
    // Clicks without a valid pick are rejected by the reducer guard (Q-A).
    act(() => api.current.onClick({ x: 0, y: 0 }));
    act(() => api.current.onClick({ x: 10, y: 10 }));
    await act(async () => { await flushMicrotasks(); });
    expect(onCreated).not.toHaveBeenCalled();
    expect(dimensionCreateStore.get().clicks).toEqual([]);
  });
});

describe('useDimensionCreate — angular3P 4-click flow', () => {
  it('commits angular3P only after the 4th click', async () => {
    const onCreated = jest.fn<void, [DimensionEntity]>();
    const { api } = setup(onCreated);
    act(() => api.current.start('angular3P'));
    act(() => api.current.onClick({ x: 0, y: 0 }));
    act(() => api.current.onClick({ x: 100, y: 0 }));
    act(() => api.current.onClick({ x: 0, y: 100 }));
    await act(async () => {
      await flushMicrotasks();
    });
    expect(onCreated).not.toHaveBeenCalled();

    act(() => api.current.onClick({ x: 50, y: 50 }));
    await act(async () => {
      await flushMicrotasks();
    });
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onCreated.mock.calls[0][0].dimensionType).toBe('angular3P');
  });
});
