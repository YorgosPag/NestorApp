import { useEffect } from 'react';

/**
 * Centralized hook for handling Escape key press on the document.
 * Attaches a document-level keydown listener that fires the handler when Escape is pressed.
 *
 * @param handler — called when Escape is pressed
 * @param enabled — whether the listener is active (default: true)
 */
export function useEscapeKey(handler: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handler();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handler, enabled]);
}
