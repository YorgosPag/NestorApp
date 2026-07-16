/**
 * 🏢 ENTERPRISE CARD SHELL - Primitive Hook
 *
 * The chrome every card shell needs to draw its own element: the centralized
 * design tokens it styles with, plus the activation handlers it binds.
 *
 * Single Source of Truth for that set — a shell that reached for the tokens
 * directly would be free to drift from its sibling.
 *
 * @fileoverview Shared tokens + handlers for all card shells.
 * @enterprise Fortune 500 compliant - Uses centralized design tokens
 * @see useCardInteraction for the keyboard activation contract it composes
 * @see GridCard, ListCard for consumers
 * @author Enterprise Architecture Team
 * @since 2026-07-16
 */

// 🏢 CENTRALIZED HOOKS
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

import { useCardInteraction } from './useCardInteraction';
import type { UseCardInteractionOptions, CardInteractionHandlers } from './useCardInteraction';

/**
 * Tokens and handlers returned by {@link useCardShell}
 */
export interface CardShell extends CardInteractionHandlers {
  /** Semantic colors - backgrounds and text */
  colors: ReturnType<typeof useSemanticColors>;
  /** Ready-made border compositions */
  quick: ReturnType<typeof useBorderTokens>['quick'];
  /** Status-driven border resolver */
  getStatusBorder: ReturnType<typeof useBorderTokens>['getStatusBorder'];
  /** Spacing scale */
  spacing: ReturnType<typeof useSpacingTokens>;
}

/**
 * 🏢 useCardShell
 *
 * @example
 * ```tsx
 * const { colors, quick, getStatusBorder, spacing, handleClick, handleKeyDown } =
 *   useCardShell(props);
 * ```
 */
export function useCardShell(options: UseCardInteractionOptions): CardShell {
  const colors = useSemanticColors();
  const { quick, getStatusBorder } = useBorderTokens();
  const spacing = useSpacingTokens();
  const { handleClick, handleKeyDown } = useCardInteraction(options);

  return { colors, quick, getStatusBorder, spacing, handleClick, handleKeyDown };
}
