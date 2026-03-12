import { useEffect, type RefObject } from 'react';

interface UseClickOutsideOptions {
  /** Which event to listen on (default: 'mousedown') */
  event?: 'mousedown' | 'click';
  /** Whether the listener is active (default: true) */
  enabled?: boolean;
}

/**
 * Centralized hook for detecting clicks outside one or more elements.
 * Supports single ref or array of refs, conditional activation, and event type selection.
 *
 * @param refs — single RefObject or array of RefObjects to treat as "inside"
 * @param handler — called when a click lands outside all refs
 * @param options — event type and enabled flag
 */
export function useClickOutside(
  refs: RefObject<HTMLElement | null> | ReadonlyArray<RefObject<HTMLElement | null>>,
  handler: () => void,
  options?: UseClickOutsideOptions
): void {
  const { event = 'mousedown', enabled = true } = options ?? {};

  useEffect(() => {
    if (!enabled) return;

    const listener = (e: Event) => {
      const target = e.target as Node;
      const refArray = Array.isArray(refs) ? refs : [refs];

      // If click is inside any of the refs, do nothing
      const isInside = refArray.some(
        (ref) => ref.current?.contains(target)
      );

      if (!isInside) {
        handler();
      }
    };

    document.addEventListener(event, listener);

    return () => {
      document.removeEventListener(event, listener);
    };
  }, [refs, handler, event, enabled]);
}
