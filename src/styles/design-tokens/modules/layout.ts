// Design tokens — Layout module
// zIndex, dialog sizes, grid patterns, breakpoints, interactive states,
// entity list tokens, designTokens aggregate

import { colors, spacing, typography, shadows, animation, transitions, semanticColors } from './foundations';
import { borders } from './borders';
import { componentSizes } from './component-sizes';

// 🏢 ENTERPRISE Z-INDEX HIERARCHY - Single Source of Truth
// Synced with design-tokens.json (see ADR-002 in centralized_systems.md)
export const zIndex = {
  hide: -1,
  auto: 'auto',
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
  // 🚨 CRITICAL: Use only for system-level overlays (debuggers, error handlers)
  critical: 2147483647,
} as const;

// ============================================================================
// 🏢 ENTERPRISE: DIALOG/MODAL SIZE TOKENS
// ============================================================================
// Centralized dialog sizing for consistent modal dimensions
// ADR-031: Zero hardcoded values - all dialog sizes from here
// ============================================================================
export const DIALOG_SIZES = {
  /** Small dialog (400px) - confirmations, simple forms */
  sm: 'sm:max-w-md',
  /** Medium dialog (600px) - standard forms, selections */
  md: 'sm:max-w-[600px]',
  /** Large dialog (800px) - complex forms */
  lg: 'sm:max-w-[800px]',
  /** Extra large dialog (900px) - contact forms, multi-tab dialogs */
  xl: 'sm:max-w-[900px]',
  /** Full width dialog (1200px) - dashboards, complex UIs */
  full: 'sm:max-w-[1200px]',
} as const;

export const DIALOG_HEIGHT = {
  /** Standard dialog height constraint */
  standard: 'max-h-[90vh]',
  /** Shorter dialog for simpler content */
  short: 'max-h-[70vh]',
  /** Auto height - content determines */
  auto: '',
} as const;

export const DIALOG_SCROLL = {
  /** Enable vertical scrolling */
  scrollable: 'overflow-y-auto',
  /** No scroll - fixed content */
  fixed: 'overflow-hidden',
} as const;

// Grid patterns για layout consistency
export const gridPatterns = {
  // Stats grids
  stats: {
    mobile: 'grid-cols-1',
    tablet: 'sm:grid-cols-2',
    desktop: 'lg:grid-cols-4',
    gap: 'gap-4',
    full: 'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
  },

  // Action buttons
  actions: {
    mobile: 'grid-cols-1',
    tablet: 'sm:grid-cols-3',
    gap: 'gap-4',
    full: 'grid gap-4 grid-cols-1 sm:grid-cols-3'
  },

  // Card grids
  cards: {
    mobile: 'grid-cols-1',
    tablet: 'md:grid-cols-2',
    desktop: 'lg:grid-cols-3',
    gap: 'gap-6',
    full: 'grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
  },

  // Form layouts
  form: {
    single: 'grid-cols-1',
    double: 'md:grid-cols-2',
    triple: 'lg:grid-cols-3',
    gap: 'gap-4',
    fullDouble: 'grid gap-4 grid-cols-1 md:grid-cols-2',
    fullTriple: 'grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
  }
} as const;

// Responsive breakpoints (matching Tailwind defaults)
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// Interactive states για consistent hover/focus patterns
export const interactiveStates = {
  // Card interactions
  card: {
    base: 'transition-all duration-200',
    hover: 'hover:shadow-md hover:scale-[1.02]',
    focus: 'focus:ring-2 focus:ring-ring focus:ring-offset-2',
    active: 'active:scale-[0.98]',
    full: 'transition-all duration-200 hover:shadow-md hover:scale-[1.02] focus:ring-2 focus:ring-ring focus:ring-offset-2 active:scale-[0.98]'
  },

  // Button interactions
  button: {
    base: 'transition-colors duration-200',
    hover: 'hover:opacity-90',
    focus: 'focus:ring-2 focus:ring-ring focus:ring-offset-2',
    active: 'active:scale-95',
    full: 'transition-colors duration-200 hover:opacity-90 focus:ring-2 focus:ring-ring focus:ring-offset-2 active:scale-95'
  },

  // Link interactions
  link: {
    base: 'transition-colors duration-200',
    hover: 'hover:text-primary hover:underline',
    focus: 'focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:rounded-sm',
    full: 'transition-colors duration-200 hover:text-primary hover:underline focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:rounded-sm'
  }
} as const;

// ============================================================================
// 🏢 ENTITY LIST TOKENS
// ============================================================================

/**
 * 🏢 ENTITY_LIST_PRIMITIVES
 *
 * Single Source of Truth for all entity list dimensions.
 * ALL derived values (classes, CSS) MUST reference these primitives.
 *
 * @enterprise Fortune 500 compliant - Autodesk/Bentley standard
 * @immutable These values should NEVER be duplicated or hardcoded elsewhere
 */
const ENTITY_LIST_PRIMITIVES = {
  /** Minimum width of entity list column in pixels */
  MIN_WIDTH: 300,
  /** Maximum width of entity list column in pixels */
  MAX_WIDTH: 420,
  /** Space reserved for scrollbar appearance on hover in pixels */
  SCROLLBAR_SPACE: 8,
} as const;

/**
 * 🏢 ENTITY_LIST_TOKENS
 *
 * Centralized tokens for entity list columns (Buildings, Contacts, Units, etc.)
 *
 * ⚠️ CRITICAL: Tailwind classes MUST be STATIC strings (not template literals)!
 * Template literals like `min-w-[${VALUE}px]` are NOT detected by Tailwind JIT
 * and no CSS will be generated - causing full-width layouts.
 *
 * ✅ SOLUTION: Use CSS variables with static class names:
 *    min-w-[var(--entity-list-min)] instead of min-w-[${VALUE}px]
 *
 * CSS Variables defined in: src/app/globals.css
 *   --entity-list-min: 300px
 *   --entity-list-max: 420px
 *   --entity-list-scrollbar-space: 8px
 *
 * @enterprise Fortune 500 compliant - Autodesk/Bentley/Google standard
 * @see ENTITY_LIST_PRIMITIVES for numeric values (kept for reference)
 * @see src/app/globals.css for CSS variable definitions
 * @see src/core/containers/EntityListColumn.tsx - Component that uses these tokens
 * @author Enterprise Architecture Team
 * @since 2026-01-09
 */
export const ENTITY_LIST_TOKENS = {
  /** 🏢 RAW NUMERIC VALUES - Direct access to primitives (for reference only) */
  values: ENTITY_LIST_PRIMITIVES,

  /**
   * Width constraints for list columns
   * ✅ STATIC class names using CSS variables - Tailwind JIT compatible
   */
  width: {
    min: 'min-w-[var(--entity-list-min)]',
    max: 'max-w-[var(--entity-list-max)]',
    /** Combined width classes */
    combined: 'min-w-[var(--entity-list-min)] max-w-[var(--entity-list-max)]',
  },

  /**
   * 🏢 CARD DIMENSIONS - For items inside list
   * ✅ STATIC class names using CSS variables - Tailwind JIT compatible
   */
  card: {
    /** Width accounting for scrollbar space on hover */
    width: 'w-[calc(100%-var(--entity-list-scrollbar-space))]',
    /** Full width without scrollbar compensation */
    fullWidth: 'w-full',
  },

  /** Layout configuration - Standard flexbox patterns */
  layout: {
    display: 'flex',
    direction: 'flex-col',
    shrink: 'shrink-0',
    /** Combined layout classes */
    combined: 'flex flex-col shrink-0',
  },

  /** Visual styling - Semantic token references */
  visual: {
    background: 'bg-card',
    shadow: 'shadow-sm',
    overflow: 'overflow-hidden',
    maxHeight: 'max-h-full',
    heightFit: 'h-fit',
  },
} as const;

/** Type for ENTITY_LIST_TOKENS for external usage */
export type EntityListTokens = typeof ENTITY_LIST_TOKENS;

// Export all tokens as a single object για convenience
export const designTokens = {
  spacing,
  typography,
  borderRadius: borders.radius,
  shadows,
  animation,
  transitions,
  colors,
  semanticColors,
  zIndex,
  gridPatterns,
  componentSizes,
  breakpoints,
  interactiveStates,
} as const;
