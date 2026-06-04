/**
 * ADR-040 — `useCursorWorldPosition(enabled)` SSoT gate tests.
 *
 * The gate is the single funnel every preview/ghost leaf passes through: when a
 * leaf's tool is idle it passes `enabled = false`, so it MUST NOT subscribe to
 * the 60fps world-position stream and MUST NOT re-render on mouse move. When the
 * tool activates (`enabled = true`) the subscription re-attaches reactively.
 *
 * Verifies behaviour against the real `ImmediatePositionStore` singleton (no mock).
 */

import { act } from 'react';
import { renderHook } from '@testing-library/react';

// `useCursorWorldPosition` is standalone (only `useSyncExternalStore`), but
// `useCursor.ts` imports `CursorContext` from `CursorSystem`, which transitively
// pulls in the Firebase-auth-backed cursor config. Mock that module to keep the
// test a pure unit test of the gate (no network / no firebase in Node env).
jest.mock('../CursorSystem', () => ({ CursorContext: { Provider: () => null } }));

import { useCursorWorldPosition } from '../useCursor';
import { setImmediateWorldPosition } from '../ImmediatePositionStore';

afterEach(() => {
  act(() => setImmediateWorldPosition(null));
});

describe('useCursorWorldPosition — SSoT gate (ADR-040)', () => {
  it('subscribes and tracks the world position when enabled', () => {
    const { result } = renderHook(() => useCursorWorldPosition(true));
    expect(result.current).toBeNull();

    act(() => setImmediateWorldPosition({ x: 10, y: 20 }));
    expect(result.current).toEqual({ x: 10, y: 20 });

    act(() => setImmediateWorldPosition({ x: 30, y: 40 }));
    expect(result.current).toEqual({ x: 30, y: 40 });
  });

  it('does NOT subscribe or re-render when disabled (idle leaf)', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useCursorWorldPosition(false);
    });
    const rendersAfterMount = renders;

    act(() => setImmediateWorldPosition({ x: 99, y: 99 }));

    // Disabled leaf stays null and does NOT re-render on the mousemove stream.
    expect(result.current).toBeNull();
    expect(renders).toBe(rendersAfterMount);
  });

  it('re-subscribes reactively when the gate flips, unsubscribes when it closes', () => {
    const enabled = { value: false };
    const { result, rerender } = renderHook(() => useCursorWorldPosition(enabled.value));

    // Disabled → no tracking.
    act(() => setImmediateWorldPosition({ x: 1, y: 1 }));
    expect(result.current).toBeNull();

    // Flip to enabled → re-subscribes reactively, starts tracking.
    enabled.value = true;
    rerender();
    act(() => setImmediateWorldPosition({ x: 2, y: 2 }));
    expect(result.current).toEqual({ x: 2, y: 2 });

    // Flip back to disabled → unsubscribes, stops tracking, returns stable null.
    enabled.value = false;
    rerender();
    act(() => setImmediateWorldPosition({ x: 3, y: 3 }));
    expect(result.current).toBeNull();
  });
});
