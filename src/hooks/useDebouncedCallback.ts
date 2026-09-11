/**
 * @fileoverview useDebouncedCallback — Debounce a callback function
 * @description Unlike useDebounce (which debounces a value), this hook debounces
 * a **callback invocation**. The returned function delays execution until `delay` ms
 * have passed since the last call. Automatically cleans up on unmount.
 *
 * `cancel()` (2026-09-11, προσθετικό): ακυρώνει την εκκρεμή κλήση — το χρειάζεται όποιος
 * πρέπει να ΑΚΥΡΩΣΕΙ μια μπαγιάτικη εκπομπή όταν η τιμή αλλάξει από έξω (SearchInput,
 * εύρημα ζωντανής επαλήθευσης ADR-332 D27 Β-ΙΙ). Το `cancel` είναι σταθερό σε όλη τη ζωή.
 *
 * Promoted from: src/subapps/dxf-viewer/stores/useDxfSettings.ts (lines 22-50)
 *
 * @version 1.1.0
 * @created 2026-03-12
 * @see ADR-217 Phase 11
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';

/** Η debounced συνάρτηση — καλείται όπως πριν, και ακυρώνεται με `cancel()`. */
interface DebouncedCallback<Args extends unknown[]> {
  (...args: Args): void;
  /** Ακυρώνει την εκκρεμή κλήση, αν υπάρχει. Σταθερή αναφορά. */
  cancel: () => void;
}

/**
 * Returns a debounced version of the given callback.
 *
 * @param callback - The function to debounce
 * @param delay - Debounce delay in milliseconds
 * @returns A function that schedules `callback` after `delay` ms of inactivity, with `cancel()`
 *
 * @example
 * ```ts
 * const debouncedSave = useDebouncedCallback((value: string) => {
 *   saveToDB(value);
 * }, 300);
 * debouncedSave.cancel(); // η εκκρεμής αποθήκευση δεν θα γίνει
 * ```
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delay: number
): DebouncedCallback<Args> {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const cancel = useCallback(() => {
    if (timeoutRef.current !== undefined) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, []);

  useEffect(() => cancel, [cancel]);

  return useMemo(() => {
    const debounced = (...args: Args) => {
      cancel();
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = undefined;
        callback(...args);
      }, delay);
    };
    return Object.assign(debounced, { cancel });
  }, [callback, delay, cancel]);
}
