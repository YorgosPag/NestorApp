/**
 * 🏢 ENTERPRISE CARD PRIMITIVES - Barrel Export
 *
 * Single entry point for all Card primitive components.
 *
 * @fileoverview Exports the Card primitives and their types.
 * @enterprise Fortune 500 compliant
 * @author Enterprise Architecture Team
 * @since 2026-01-08
 */

// =============================================================================
// 🏢 COMPONENT EXPORTS
// =============================================================================

export { CardIcon } from './CardIcon';
export { CardStats } from './CardStats';
export { CardHeaderBlock } from './CardHeaderBlock';
export { CardTitleBlock } from './CardTitleBlock';
export { CardBadges } from './CardBadges';
export { CardBody } from './CardBody';
export { CardActionsToolbar } from './CardActionsToolbar';
export { CardSelectionIndicator } from './CardSelectionIndicator';

// =============================================================================
// 🏢 HOOK EXPORTS
// =============================================================================

export { useCardInteraction } from './useCardInteraction';
export type { UseCardInteractionOptions, CardInteractionHandlers } from './useCardInteraction';
export { useCardShell } from './useCardShell';
export type { CardShell } from './useCardShell';

// =============================================================================
// 🏢 UTILITY EXPORTS
// =============================================================================

export { pickCardIdentity } from './card-identity';

// =============================================================================
// 🏢 TYPE EXPORTS
// =============================================================================

export type { CardHeaderBlockProps } from './CardHeaderBlock';
export type { CardTitleBlockProps } from './CardTitleBlock';
export type { CardBadgesProps } from './CardBadges';
export type { CardBodyProps } from './CardBody';
export type { CardActionsToolbarProps } from './CardActionsToolbar';
export type { CardSelectionIndicatorProps } from './CardSelectionIndicator';

export type {
  // CardIcon types
  CardIconProps,
  CardIconVariant,
  CardIconSize,
  // CardStats types
  CardStatsProps,
  StatItem,
  StatsLayout,
  // Shared card vocabulary
  CardBadge,
  CardBadgeVariant,
  CardAction,
  CardIdentityProps,
  CardBaseProps,
} from './types';

// =============================================================================
// 🏢 CONSTANT EXPORTS
// =============================================================================

export { CARD_SIZES, CARD_ROUNDED } from './types';
