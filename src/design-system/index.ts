/**
 * 🏢 ENTERPRISE DESIGN SYSTEM - Main Entry Point
 *
 * Central export for all design system components, tokens, and utilities.
 *
 * @fileoverview Main barrel export for the design system.
 * @enterprise Fortune 500 compliant - Single source of truth
 * @author Enterprise Architecture Team
 * @since 2026-01-08
 */

// =============================================================================
// 🏢 PRIMITIVES (Atoms)
// =============================================================================

export {
  // Card Primitives
  CardIcon,
  CardStats,
  // Types
  type CardIconProps,
  type CardIconVariant,
  type CardIconSize,
  type CardStatsProps,
  type StatItem,
  type StatsLayout,
  type ListCardBaseProps,
  type ListCardSelectionState,
  type ListCardBadge,
  // Constants
  CARD_SIZES,
  CARD_ROUNDED,
} from './primitives';

// =============================================================================
// 🏢 TOKENS
// =============================================================================

export { colorTokens, hardcodedColorValues } from './tokens/colors';
export type {
  ColorTokenCategory,
  TextColorToken,
  BackgroundColorToken,
  BorderColorToken,
} from './tokens/colors';

// =============================================================================
// 🏢 SEMANTICS
// =============================================================================

export {
  semanticColors,
  statusSemantics,
  domainSemantics,
  allSemantics,
} from './semantics/colors';
export type {
  SemanticColorCategory,
  StatusSemanticCategory,
  DomainSemanticCategory,
} from './semantics/colors';

// =============================================================================
// 🏢 PATTERNS
// =============================================================================

export {
  surfacePatterns,
  feedbackPatterns,
  interactivePatterns,
  layoutPatterns,
  uiPatterns,
} from './patterns/ui';
export type {
  UiPatternCategory,
  SurfacePattern,
  FeedbackPattern,
  InteractivePattern,
  LayoutPattern,
} from './patterns/ui';

// =============================================================================
// 🏢 COLOR BRIDGE
// =============================================================================

export {
  COLOR_BRIDGE,
  validateBridgeMapping,
  BRIDGE_STATS,
} from './color-bridge';
export type {
  BgColorKey,
  TextColorKey,
  BorderColorKey,
} from './color-bridge';

// =============================================================================
// 🏢 COMPONENTS (Molecules)
// =============================================================================

export {
  ListCard,
  type ListCardProps,
  type ListCardBadge as ListCardBadgeConfig,
  type ListCardBadgeVariant,
  type ListCardAction,
} from './components';
