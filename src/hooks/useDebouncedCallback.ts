/**
 * @fileoverview useDebouncedCallback — Debounce a callback function
 * @description Unlike useDebounce (which debounces a value), this hook debounces
 * a **callback invocation**. The returned function delays execution until `delay` ms
 * have passed since the last call. Automatically cleans up on unmount.
 *
 * Promoted from: src/subapps/dxf-viewer/stores/useDxfSettings.ts (lines 22-50)
 *
 * @version 1.0.0
 * @created 2026-03-12
 * @see ADR-217 Phase 11
 */

import { useCallback, useEffect, useRef } from 'react';

/**
 * Returns a debounced version of the given callback.
 *
 * @param callback - The function to debounce
 * @param delay - Debounce delay in milliseconds
 * @returns A stable function that schedules `callback` after `delay` ms of inactivity
 *
 * @example
 * ```ts
 * const debouncedSave = useDebouncedCallback((value: string) => {
 *   saveToDB(value);
 * }, 300);
 * ```
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delay: number
): (...args: Args) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = useCallback(
    (...args: Args) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );

  return debouncedCallback;
}
