import { useState, useCallback } from 'react';

// =============================================================================
// 🏢 ENTERPRISE: Centralized Fullscreen Hook (ADR-241)
// =============================================================================
//
// Single source of truth for fullscreen STATE — και μόνο αυτό.
//
// 📌 2026-09-11: το Escape, το κλείδωμα κύλισης, το focus και η αδράνεια έφυγαν από εδώ και ζουν στην ΕΠΙΦΑΝΕΙΑ
// (`FullscreenOverlay` → `core/containers/fullscreen/use-fullscreen-surface`). Ανήκουν σε αυτό που ζωγραφίζεται, όχι
// στην κατάσταση:
//   - Ως τότε το Escape ήταν ωμός listener εδώ ⇒ ένα Esc με Select / μενού / διάλογο ανοιχτό μέσα στην πλήρη οθόνη
//     έκλεινε και τα δύο (μετρημένο ζωντανά σε 4 καταναλωτές + DXF).
//   - Ένας κάτοχος κατάστασης που ζωγραφίζει αλλού (FloorplanGallery: Radix `<Dialog size="fullscreen">`) θα είχε
//     τότε ΔΥΟ ιδιοκτήτες Escape για το ίδιο πάτημα — τον Radix και αυτό το hook.
//
// Supports controlled + uncontrolled mode (Radix pattern).
// =============================================================================

export interface UseFullscreenOptions {
  /** Controlled mode: external isFullscreen state */
  isFullscreen?: boolean;
  /** Controlled mode: external setter */
  onFullscreenChange?: (isFullscreen: boolean) => void;
  /** Default value for uncontrolled mode (default: false) */
  defaultFullscreen?: boolean;
}

export interface UseFullscreenReturn {
  /** Current fullscreen state */
  isFullscreen: boolean;
  /** Toggle fullscreen on/off */
  toggle: () => void;
  /** Enter fullscreen */
  enter: () => void;
  /** Exit fullscreen */
  exit: () => void;
}

/**
 * Centralized hook for fullscreen state management.
 *
 * @example Uncontrolled (most common)
 * ```tsx
 * const fs = useFullscreen();
 * <FullscreenOverlay isFullscreen={fs.isFullscreen} onToggle={fs.toggle}>…</FullscreenOverlay>
 * ```
 *
 * @example Controlled
 * ```tsx
 * const [open, setOpen] = useState(false);
 * const fs = useFullscreen({ isFullscreen: open, onFullscreenChange: setOpen });
 * ```
 */
export function useFullscreen(options: UseFullscreenOptions = {}): UseFullscreenReturn {
  const { isFullscreen: controlledValue, onFullscreenChange, defaultFullscreen = false } = options;

  const isControlled = controlledValue !== undefined;

  const [internalState, setInternalState] = useState(defaultFullscreen);

  const isFullscreen = isControlled ? controlledValue : internalState;

  const setFullscreen = useCallback(
    (value: boolean) => {
      if (!isControlled) {
        setInternalState(value);
      }
      onFullscreenChange?.(value);
    },
    [isControlled, onFullscreenChange]
  );

  const toggle = useCallback(() => setFullscreen(!isFullscreen), [setFullscreen, isFullscreen]);
  const enter = useCallback(() => setFullscreen(true), [setFullscreen]);
  const exit = useCallback(() => setFullscreen(false), [setFullscreen]);

  return { isFullscreen, toggle, enter, exit };
}
