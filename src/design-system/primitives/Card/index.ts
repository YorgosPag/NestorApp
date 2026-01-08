/**
 * 🏢 ENTERPRISE CARD PRIMITIVES - Barrel Export
 *
 * Single entry point for all Card primitive components.
 *
 * @fileoverview Exports CardIcon, CardStats, and related types.
 * @enterprise Fortune 500 compliant
 * @author Enterprise Architecture Team
 * @since 2026-01-08
 */

// =============================================================================
// 🏢 COMPONENT EXPORTS
// =============================================================================

export { CardIcon } from './CardIcon';
export { CardStats } from './CardStats';

// =============================================================================
// 🏢 TYPE EXPORTS
// =============================================================================

export type {
  // CardIcon types
  CardIconProps,
  CardIconVariant,
  CardIconSize,
  // CardStats types
  CardStatsProps,
  StatItem,
  StatsLayout,
  // List card types (for future use)
  ListCardBaseProps,
  ListCardSelectionState,
  ListCardBadge,
} from './types';

// =============================================================================
// 🏢 CONSTANT EXPORTS
// =============================================================================

export { CARD_SIZES, CARD_ROUNDED } from './types';
