import { useEffect, useRef } from 'react';

/**
 * Centralized hook for declarative setInterval.
 * Uses a ref-based callback so the latest closure is always invoked (no stale closures).
 *
 * @param callback — function called on each tick
 * @param delay — interval in ms, or `null` to pause/disable
 * @param enabled — additional guard; when false the interval is paused (default: true)
 *
 * @see ADR-205 Phase 4 — useInterval centralization
 */
export function useInterval(
  callback: () => void,
  delay: number | null,
  enabled = true,
): void {
  const savedCallback = useRef(callback);

  // Always keep the ref up-to-date so the interval fires the latest closure.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null || !enabled) return;

    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay, enabled]);
}
