import { useState, useCallback, useEffect } from 'react';
import { useEscapeKey } from './useEscapeKey';

// =============================================================================
// 🏢 ENTERPRISE: Centralized Fullscreen Hook (ADR-241)
// =============================================================================
//
// Single source of truth for fullscreen state management.
// Handles: state toggle, Escape key exit, body scroll lock.
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
  /** Lock body scroll when fullscreen is active (default: true) */
  lockScroll?: boolean;
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
 * <button onClick={fs.toggle}>{fs.isFullscreen ? 'Exit' : 'Enter'}</button>
 * ```
 *
 * @example Controlled
 * ```tsx
 * const [open, setOpen] = useState(false);
 * const fs = useFullscreen({ isFullscreen: open, onFullscreenChange: setOpen });
 * ```
 */
export function useFullscreen(options: UseFullscreenOptions = {}): UseFullscreenReturn {
  const {
    isFullscreen: controlledValue,
    onFullscreenChange,
    defaultFullscreen = false,
    lockScroll = true,
  } = options;

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

  // Escape key exits fullscreen
  useEscapeKey(exit, isFullscreen);

  // Body scroll lock
  useEffect(() => {
    if (!lockScroll) return;

    if (isFullscreen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }

    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [isFullscreen, lockScroll]);

  return { isFullscreen, toggle, enter, exit };
}
