// ============================================================================
// 🎯 SEMANTIC COLORS - Business Meaning Layer
// ============================================================================
//
// ✨ Semantic color definitions - Business language
// Maps design tokens to business concepts (success, error, etc.)
//
// Enterprise-grade: Product managers & designers speak this language
// Stable API: Changes rarely, only when business meaning changes
//
// ============================================================================

import { colorTokens } from '../tokens/colors';

/**
 * Semantic Color Meanings - Business Concepts
 * Maps design tokens to business/product concepts
 */
export const semanticColors = {
  /** Success state - Positive outcomes */
  success: {
    text: colorTokens.text.success,
    background: colorTokens.background.success,
    border: colorTokens.border.success,
  },

  /** Error state - Negative outcomes, failures */
  error: {
    text: colorTokens.text.error,
    background: colorTokens.background.error,
    border: colorTokens.border.error,
  },

  /** Warning state - Caution, attention needed */
  warning: {
    text: colorTokens.text.warning,
    background: colorTokens.background.warning,
    border: colorTokens.border.warning,
  },

  /** Info state - Informational, neutral guidance */
  info: {
    text: colorTokens.text.info,
    background: colorTokens.background.info,
    border: colorTokens.border.info,
  },

  /** Primary brand colors */
  primary: {
    text: colorTokens.text.primary,
    background: colorTokens.background.primary,
    border: colorTokens.border.default,
  },

  /** Secondary brand colors */
  secondary: {
    text: colorTokens.text.secondary,
    background: colorTokens.background.secondary,
    border: colorTokens.border.muted,
  },

  /** Interactive states */
  interactive: {
    hover: {
      background: colorTokens.background.hover,
    },
    active: {
      background: colorTokens.background.active,
    },
    focus: {
      border: colorTokens.border.focus,
    },
  },

  /** Layout semantics */
  layout: {
    surface: colorTokens.background.surface,    // Cards, modals, panels
    container: colorTokens.background.primary,  // Main containers
    page: colorTokens.background.secondary,     // Page backgrounds
  },

  /** Subtle color variants for soft visual treatment */
  subtle: {
    successBackground: colorTokens.background.successSubtle,
    errorBackground: colorTokens.background.errorSubtle,
    infoBackground: colorTokens.background.infoSubtle,
    neutralBackground: colorTokens.background.neutralSubtle,
  },

  /** Strong color variants for emphasis */
  strong: {
    successText: colorTokens.text.successStrong,
    errorText: colorTokens.text.errorStrong,
  },
} as const;

/**
 * Status Color Semantics - Application State Meanings
 * Maps to common application states
 */
export const statusSemantics = {
  /** Active/Available status - Things that are operational */
  active: {
    text: colorTokens.text.success,
    background: colorTokens.background.success,
    border: colorTokens.border.success,
  },

  /** Inactive/Unavailable status - Things that are not operational */
  inactive: {
    text: colorTokens.text.muted,
    background: colorTokens.background.secondary,
    border: colorTokens.border.muted,
  },

  /** Pending status - Things waiting for action */
  pending: {
    text: colorTokens.text.warning,
    background: colorTokens.background.warning,
    border: colorTokens.border.warning,
  },

  /** Completed status - Things that are finished */
  completed: {
    text: colorTokens.text.info,
    background: colorTokens.background.info,
    border: colorTokens.border.info,
  },

  /** Cancelled status - Things that were stopped */
  cancelled: {
    text: colorTokens.text.error,
    background: colorTokens.background.error,
    border: colorTokens.border.error,
  },
} as const;

/**
 * Domain-Specific Semantics - Business Domain Colors
 * Colors that have meaning in specific business contexts
 */
export const domainSemantics = {
  /** Price/Financial semantics */
  price: {
    positive: colorTokens.text.success,  // Price increases, profits
    negative: colorTokens.text.error,    // Price decreases, losses
    neutral: colorTokens.text.primary,   // Regular price display
  },

  /** Parking status semantics */
  parking: {
    sold: semanticColors.success,
    owner: semanticColors.info,
    available: semanticColors.secondary,
    reserved: semanticColors.warning,
  },
} as const;

/**
 * Type definitions for semantic access
 */
export type SemanticColorCategory = keyof typeof semanticColors;
export type StatusSemanticCategory = keyof typeof statusSemantics;
export type DomainSemanticCategory = keyof typeof domainSemantics;

/**
 * Combined semantics export
 */
export const allSemantics = {
  semantic: semanticColors,
  status: statusSemantics,
  domain: domainSemantics,
} as const;

/**
 * Default export for convenience
 */
export default semanticColors;