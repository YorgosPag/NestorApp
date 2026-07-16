/**
 * 🏢 ENTERPRISE CARD INTERACTION - Primitive Hook
 *
 * Single Source of Truth for a card's activation contract: pointer click and
 * keyboard activation (Enter / Space) resolve to the same `onClick`.
 *
 * @fileoverview Shared activation handlers for all card shells.
 * @enterprise Fortune 500 compliant - WAI-ARIA keyboard activation
 * @see GridCard, ListCard for consumers
 * @author Enterprise Architecture Team
 * @since 2026-07-16
 */

import { useCallback } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

/**
 * Options for {@link useCardInteraction}
 */
export interface UseCardInteractionOptions {
  /** Activation handler - fired by click and by Enter/Space */
  onClick?: () => void;
  /** Additional keyboard handler, invoked after activation handling */
  onKeyDown?: (event: ReactKeyboardEvent) => void;
}

/**
 * Handlers returned by {@link useCardInteraction}
 */
export interface CardInteractionHandlers {
  /** Bind to the card element's `onClick` */
  handleClick: () => void;
  /** Bind to the card element's `onKeyDown` */
  handleKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
}

/**
 * 🏢 useCardInteraction
 *
 * Keeps every card shell keyboard-activatable in exactly one way, so a card can
 * never drift into being clickable but not focusable-and-activatable.
 *
 * @example
 * ```tsx
 * const { handleClick, handleKeyDown } = useCardInteraction({ onClick, onKeyDown });
 * return <article onClick={handleClick} onKeyDown={handleKeyDown} tabIndex={0} />;
 * ```
 */
export function useCardInteraction({
  onClick,
  onKeyDown,
}: UseCardInteractionOptions): CardInteractionHandlers {
  const handleClick = useCallback(() => {
    onClick?.();
  }, [onClick]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      // Accessibility: Enter or Space to select
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onClick?.();
      }
      onKeyDown?.(event);
    },
    [onClick, onKeyDown]
  );

  return { handleClick, handleKeyDown };
}
