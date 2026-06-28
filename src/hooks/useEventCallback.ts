/**
 * @fileoverview useEventCallback — a referentially-stable event handler that
 * always invokes the LATEST callback.
 * @description Returns a function whose identity NEVER changes across renders,
 * yet every invocation calls the most recent `callback` (reads latest props/state
 * at call time). This is the canonical React `useEffectEvent` / `useEvent` pattern
 * (RFC), used to stop unstable inline callbacks from breaking `React.memo` on
 * children. Use it ONLY for handlers fired in response to events (clicks, imports,
 * keyboard) — NEVER call the returned function during render (it reads a ref that
 * is synced in a layout effect).
 *
 * Replaces hand-rolled `useRef(fn)` + `useCallback(…, [])` stabilizers that were
 * starting to appear (e.g. `handleSceneChangeRef` in DxfViewerContent).
 *
 * @version 1.0.0
 * @created 2026-06-28
 * @see ADR-532 Stage 4a.1 (selection re-render cascade — stop `onSceneImported`
 *      churn from re-rendering the left panel)
 */

import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Wrap an event handler so its identity is stable while it always calls the
 * latest `callback`.
 *
 * @param callback - The handler to stabilize (sync or async; its return value is
 *   forwarded to the caller)
 * @returns A function with a permanently-stable identity that delegates to the
 *   most recent `callback`
 *
 * @example
 * ```ts
 * // Before: new identity every render → breaks memo on <Child onSave={…}/>
 * const onSave = useCallback((v: string) => save(v, levelId), [levelId]);
 *
 * // After: stable identity forever → memo holds; reads latest levelId at call time
 * const onSave = useEventCallback((v: string) => save(v, levelId));
 * ```
 */
export function useEventCallback<Args extends unknown[], R>(
  callback: (...args: Args) => R
): (...args: Args) => R {
  const callbackRef = useRef(callback);

  // Keep the ref pointing at the latest callback after each commit. A layout
  // effect (not plain assignment in render) keeps this safe under StrictMode /
  // concurrent re-renders that may be thrown away.
  useLayoutEffect(() => {
    callbackRef.current = callback;
  });

  // Stable forever (empty deps) — delegates to whatever the ref currently holds.
  return useCallback((...args: Args) => callbackRef.current(...args), []);
}
