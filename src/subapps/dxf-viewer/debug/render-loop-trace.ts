/**
 * @module render-loop-trace
 * @description Dev-only diagnostics for idle render-loop investigation (ADR-040).
 *
 * SSOT helper for React-render diagnostics. Three primitives:
 *   - `useRenderTrace(label, snapshot)` — logs ref-vs-content changes per render.
 *   - `installSetStateTracer()` — monkey-patches `React.useState` / `useReducer`
 *     to flag dispatches where `prev !== next` but `JSON.stringify(prev) === JSON.stringify(next)`
 *     (i.e. pure reference churn — the upstream root cause of idle re-renders).
 *
 * Enable: set env `NEXT_PUBLIC_TRACE_RENDER_LOOP=1` (build-time) AND/OR
 * runtime override via `localStorage.setItem('TRACE_RENDER_LOOP','1')`.
 *
 * All exports are NO-OPs when the flag is disabled — zero prod overhead.
 */

import * as React from 'react';

const ENV_FLAG = (process.env.NEXT_PUBLIC_TRACE_RENDER_LOOP ?? '') === '1';

function isEnabled(): boolean {
  if (ENV_FLAG) return true;
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem('TRACE_RENDER_LOOP') === '1';
  } catch {
    return false;
  }
}

function safeStr(v: unknown): string {
  try {
    return JSON.stringify(v, (_k, val) => {
      if (typeof val === 'function') return '[fn]';
      if (val instanceof Map || val instanceof Set) {
        return `[${val.constructor.name}:${(val as Set<unknown>).size}]`;
      }
      return val;
    });
  } catch {
    return '[uncomparable]';
  }
}

/**
 * Logs `[<label>] #N content-changed: … | ref-only: …` once per render.
 * Render #1 prints `INITIAL keys=N` (no diff baseline).
 */
export function useRenderTrace(label: string, snapshot: Record<string, unknown>): void {
  const prevRef = React.useRef<Record<string, unknown>>({});
  const countRef = React.useRef(0);
  countRef.current++;
  const currentCount = countRef.current;

  React.useEffect(() => {
    if (!isEnabled()) return;
    if (currentCount === 1) {
      // eslint-disable-next-line no-console
      console.log(`[${label}] #1 INITIAL keys=${Object.keys(snapshot).length}`);
      prevRef.current = snapshot;
      return;
    }
    const prev = prevRef.current;
    const refChanged: string[] = [];
    const contentChanged: string[] = [];
    for (const [k, v] of Object.entries(snapshot)) {
      if (prev[k] !== v) {
        refChanged.push(k);
        if (safeStr(prev[k]) !== safeStr(v)) contentChanged.push(k);
      }
    }
    // eslint-disable-next-line no-console
    console.log(
      `[${label}] #${currentCount} content-changed:`,
      contentChanged.length === 0 ? '(NONE — pure ref churn!)' : contentChanged.join(','),
      '| ref-only:',
      refChanged.filter((k) => !contentChanged.includes(k)).join(','),
    );
    prevRef.current = snapshot;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// setState tracer — monkey-patches React.useState / useReducer to detect
// dispatches where new ref carries identical content (= the root-cause symptom).
// ─────────────────────────────────────────────────────────────────────────────

let tracerInstalled = false;

function formatStack(): string {
  const raw = new Error().stack ?? '';
  const lines = raw.split('\n').slice(1);
  const filtered = lines.filter((l) => {
    const s = l.toLowerCase();
    if (s.includes('render-loop-trace')) return false;
    if (s.includes('react-dom')) return false;
    if (s.includes('react.development')) return false;
    if (s.includes('scheduler')) return false;
    if (s.includes('node_modules\\next')) return false;
    if (s.includes('node_modules/next')) return false;
    return true;
  });
  return filtered.slice(0, 6).join('\n');
}

function tryWarnChurn(label: string, prev: unknown, next: unknown): void {
  if (Object.is(prev, next)) return;
  const ps = safeStr(prev);
  const ns = safeStr(next);
  if (ps !== ns) return;
  // eslint-disable-next-line no-console
  console.warn(
    `[SETSTATE-CHURN ${label}] new ref, same content. prev=${ps.slice(0, 120)} next=${ns.slice(0, 120)}\n${formatStack()}`,
  );
}

/**
 * Patches `React.useState` and `React.useReducer` so every dispatch that
 * creates a new reference with content-equal payload logs a `[SETSTATE-CHURN]`
 * warning with stack trace. Idempotent (re-import safe). No-op when disabled.
 */
export function installSetStateTracer(): void {
  if (!isEnabled()) return;
  if (tracerInstalled) return;
  tracerInstalled = true;

  const origUseState = React.useState;
  const origUseReducer = React.useReducer;
  const origUseSyncExternalStore = React.useSyncExternalStore;

  const patchedUseState = function <S>(
    initial: S | (() => S),
  ): [S, React.Dispatch<React.SetStateAction<S>>] {
    const [state, setState] = origUseState<S>(initial);
    const wrappedSet: React.Dispatch<React.SetStateAction<S>> = (action) => {
      const prev = state;
      const next = typeof action === 'function' ? (action as (p: S) => S)(prev) : action;
      tryWarnChurn('useState', prev, next);
      setState(action);
    };
    return [state, wrappedSet];
  } as typeof React.useState;

  const patchedUseReducer = function <R extends React.Reducer<unknown, unknown>, I>(
    reducer: R,
    initialArg: I,
    init?: (arg: I) => React.ReducerState<R>,
  ): [React.ReducerState<R>, React.Dispatch<React.ReducerAction<R>>] {
    const [state, dispatch] = (origUseReducer as unknown as (
      r: R,
      a: I,
      i?: (arg: I) => React.ReducerState<R>,
    ) => [React.ReducerState<R>, React.Dispatch<React.ReducerAction<R>>])(reducer, initialArg, init);
    const wrappedDispatch: React.Dispatch<React.ReducerAction<R>> = (action) => {
      const prev = state;
      let next: React.ReducerState<R>;
      try {
        next = reducer(prev, action) as React.ReducerState<R>;
      } catch {
        dispatch(action);
        return;
      }
      tryWarnChurn('useReducer', prev, next);
      dispatch(action);
    };
    return [state, wrappedDispatch];
  } as typeof React.useReducer;

  // useSyncExternalStore patch: detects Zustand/external-store snapshots that
  // re-emit a NEW reference with content-equal payload (the most common cause
  // of React 18 idle re-renders in this codebase).
  const patchedUseSyncExternalStore = function <S>(
    subscribe: (cb: () => void) => () => void,
    getSnapshot: () => S,
    getServerSnapshot?: () => S,
  ): S {
    const value = origUseSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const prevRef = React.useRef<{ v: S | undefined; init: boolean }>({ v: undefined, init: false });
    React.useEffect(() => {
      if (prevRef.current.init) {
        tryWarnChurn('useSyncExternalStore', prevRef.current.v, value);
      }
      prevRef.current.v = value;
      prevRef.current.init = true;
    });
    return value;
  } as typeof React.useSyncExternalStore;

  // Defensive assignment: React namespace may be frozen (Firefox + Turbopack).
  // Try Object.defineProperty as fallback before giving up on each hook.
  const tryPatch = (key: 'useState' | 'useReducer' | 'useSyncExternalStore', value: unknown): boolean => {
    const target = React as unknown as Record<string, unknown>;
    try {
      target[key] = value;
      return target[key] === value;
    } catch {
      // fall through
    }
    try {
      Object.defineProperty(target, key, { value, writable: true, configurable: true });
      return target[key] === value;
    } catch {
      return false;
    }
  };

  const okUS = tryPatch('useState', patchedUseState);
  const okUR = tryPatch('useReducer', patchedUseReducer);
  const okUSES = tryPatch('useSyncExternalStore', patchedUseSyncExternalStore);

  // eslint-disable-next-line no-console
  console.log(
    `[render-loop-trace] tracer install — useState=${okUS} useReducer=${okUR} useSyncExternalStore=${okUSES}`,
  );
  if (!okUS && !okUR && !okUSES) {
    // eslint-disable-next-line no-console
    console.warn(
      '[render-loop-trace] React namespace is non-extensible (Firefox/Turbopack). ' +
        'Tracer install failed. Try Chrome, or use React DevTools Profiler instead.',
    );
  }
}
