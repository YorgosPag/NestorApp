/**
 * 🧪 useEventCallback — referentially-stable handler that calls the latest fn.
 *
 * Guards ADR-532 Stage 4a.1: a stable `onSceneImported` must NOT change identity
 * across renders (so `React.memo` children hold), while still invoking the most
 * recent closure (no stale level/scene at call time).
 */

import { renderHook, act } from '@testing-library/react';
import { useEventCallback } from '../useEventCallback';

describe('useEventCallback', () => {
  it('keeps a stable identity across re-renders', () => {
    const { result, rerender } = renderHook(
      ({ cb }: { cb: () => void }) => useEventCallback(cb),
      { initialProps: { cb: () => {} } },
    );

    const first = result.current;
    rerender({ cb: () => {} }); // brand-new callback reference
    rerender({ cb: () => {} });

    expect(result.current).toBe(first); // identity never changed
  });

  it('invokes the LATEST callback, not the one captured at mount', () => {
    const calls: string[] = [];
    const { result, rerender } = renderHook(
      ({ tag }: { tag: string }) => useEventCallback(() => calls.push(tag)),
      { initialProps: { tag: 'A' } },
    );

    const stable = result.current;
    rerender({ tag: 'B' }); // latest closure should win
    act(() => {
      stable(); // call the ORIGINAL stable reference
    });

    expect(calls).toEqual(['B']);
  });

  it('forwards arguments and the return value', () => {
    const { result } = renderHook(() =>
      useEventCallback((a: number, b: number) => a + b),
    );

    let sum = 0;
    act(() => {
      sum = result.current(2, 3);
    });

    expect(sum).toBe(5);
  });

  it('forwards async return values (Promise)', async () => {
    const { result } = renderHook(() =>
      useEventCallback(async (x: number) => x * 10),
    );

    let out = 0;
    await act(async () => {
      out = await result.current(4);
    });

    expect(out).toBe(40);
  });
});
