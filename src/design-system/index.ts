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

// Card primitives (CardIcon, CardStats, CardHeaderBlock, …), the shared card
// vocabulary (CardBadge, CardAction, CardBaseProps, …) and the card constants.
// Re-listing them here would be a second copy to keep in sync.
export * from './primitives';

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

// 🏢 LIST CARD (Horizontal Layout - For List Views)
export {
  ListCard,
  type ListCardProps,
  type ListCardBadge as ListCardBadgeConfig,
  type ListCardBadgeVariant,
  type ListCardAction,
} from './components';

// 🏢 GRID CARD (Vertical Layout - For Grid/Tile Views)
export {
  GridCard,
  type GridCardProps,
  type GridCardBadge as GridCardBadgeConfig,
  type GridCardBadgeVariant,
  type GridCardAction,
} from './components';
