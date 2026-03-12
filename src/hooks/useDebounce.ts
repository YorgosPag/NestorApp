import { useEffect, useState } from 'react';

/**
 * Centralized hook for debouncing a value.
 * Returns a debounced copy that updates only after `delay` ms of inactivity.
 *
 * @param value — the raw value to debounce
 * @param delay — debounce window in ms
 * @returns the debounced value
 *
 * @see ADR-206 Phase 5 — useDebounce centralization
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
