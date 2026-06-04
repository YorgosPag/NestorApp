/**
 * 🔴 TEMP DEBUG — render trace for the "hover lag → ribbon re-render storm"
 * investigation (2026-06-04). REMOVE this file + all its call sites once the
 * root cause is found. Logs each render with a running count and, when props
 * are passed, WHICH prop changed reference since the previous render (so a
 * broken React.memo / unstable object reference shows up immediately).
 */

import { useRef } from 'react';

export function useRenderTrace(name: string, props?: Record<string, unknown>): void {
  const countRef = useRef(0);
  const prevProps = useRef<Record<string, unknown> | undefined>(undefined);
  const lastTs = useRef(0);
  countRef.current += 1;

  const now = performance.now();
  const dt = lastTs.current ? Math.round(now - lastTs.current) : 0;
  lastTs.current = now;

  let changed = '';
  if (props && prevProps.current) {
    const prev = prevProps.current;
    changed = Object.keys(props)
      .filter((k) => props[k] !== prev[k])
      .join(', ');
  }
  prevProps.current = props;

  // eslint-disable-next-line no-console
  console.log(
    `[RENDER] ${name} #${countRef.current} +${dt}ms${changed ? `  Δprops=[${changed}]` : ''}`,
  );
}
