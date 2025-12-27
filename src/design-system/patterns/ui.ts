// ============================================================================
// 🎨 UI PATTERNS - Design Recipe Layer
// ============================================================================
//
// ✨ UI patterns - Design language definitions
// Describes WHAT UI elements are, not HOW they're implemented
//
// Enterprise-grade: Design system contracts
// Framework-agnostic: Can be consumed by any UI framework
//
// ============================================================================

import { semanticColors, statusSemantics } from '../semantics/colors';

/**
 * Surface Patterns - Card, panel, modal definitions
 * Describes visual treatment of surface elements
 */
export const surfacePatterns = {
  /** Standard card pattern */
  card: {
    background: semanticColors.layout.surface,
    border: semanticColors.secondary.border,
    interactive: {
      hover: semanticColors.interactive.hover.background,
      selected: semanticColors.info.background,
    },
  },

  /** Panel pattern - For sidebars, drawers */
  panel: {
    background: semanticColors.layout.container,
    border: semanticColors.secondary.border,
  },

  /** Modal pattern - For overlays, dialogs */
  modal: {
    background: semanticColors.layout.surface,
    backdrop: semanticColors.secondary.background,
  },

  /** Page layout pattern */
  page: {
    background: semanticColors.layout.page,
    container: semanticColors.layout.container,
  },
} as const;

/**
 * Feedback Patterns - Alert, notification, status definitions
 * Describes visual treatment of feedback elements
 */
export const feedbackPatterns = {
  /** Alert patterns - For system messages */
  alert: {
    success: {
      background: semanticColors.success.background,
      text: semanticColors.success.text,
      border: semanticColors.success.border,
    },
    error: {
      background: semanticColors.error.background,
      text: semanticColors.error.text,
      border: semanticColors.error.border,
    },
    warning: {
      background: semanticColors.warning.background,
      text: semanticColors.warning.text,
      border: semanticColors.warning.border,
    },
    info: {
      background: semanticColors.info.background,
      text: semanticColors.info.text,
      border: semanticColors.info.border,
    },
  },

  /** Badge patterns - For labels, status indicators */
  badge: {
    success: statusSemantics.completed,
    error: statusSemantics.cancelled,
    warning: statusSemantics.pending,
    info: statusSemantics.active,
  },

  /** Status indicator patterns */
  status: {
    active: statusSemantics.active,
    inactive: statusSemantics.inactive,
    pending: statusSemantics.pending,
    completed: statusSemantics.completed,
    cancelled: statusSemantics.cancelled,
  },
} as const;

/**
 * Interactive Patterns - Button, link, input definitions
 * Describes visual treatment of interactive elements
 */
export const interactivePatterns = {
  /** Button patterns */
  button: {
    primary: {
      default: {
        background: semanticColors.primary.background,
        text: semanticColors.primary.text,
        border: semanticColors.primary.border,
      },
      hover: {
        background: semanticColors.interactive.hover.background,
      },
      focus: {
        border: semanticColors.interactive.focus.border,
      },
    },
    secondary: {
      default: {
        background: semanticColors.secondary.background,
        text: semanticColors.secondary.text,
        border: semanticColors.secondary.border,
      },
      hover: {
        background: semanticColors.interactive.hover.background,
      },
    },
  },

  /** Link patterns */
  link: {
    default: {
      text: semanticColors.info.text,
    },
    hover: {
      text: semanticColors.info.text, // Slightly different shade in implementation
    },
  },

  /** Input patterns */
  input: {
    default: {
      background: semanticColors.layout.surface,
      text: semanticColors.primary.text,
      border: semanticColors.secondary.border,
    },
    focus: {
      border: semanticColors.interactive.focus.border,
    },
    error: {
      border: semanticColors.error.border,
    },
  },
} as const;

/**
 * Layout Patterns - Grid, list, table definitions
 * Describes visual treatment of layout elements
 */
export const layoutPatterns = {
  /** Table patterns */
  table: {
    header: {
      background: semanticColors.secondary.background,
      text: semanticColors.primary.text,
    },
    row: {
      default: {
        background: semanticColors.layout.surface,
      },
      alternate: {
        background: semanticColors.secondary.background,
      },
      hover: {
        background: semanticColors.interactive.hover.background,
      },
      selected: {
        background: semanticColors.info.background,
      },
    },
  },

  /** List patterns */
  list: {
    item: {
      default: {
        background: semanticColors.layout.surface,
      },
      hover: {
        background: semanticColors.interactive.hover.background,
      },
      selected: {
        background: semanticColors.info.background,
      },
    },
  },
} as const;

/**
 * Combined UI patterns export
 */
export const uiPatterns = {
  surface: surfacePatterns,
  feedback: feedbackPatterns,
  interactive: interactivePatterns,
  layout: layoutPatterns,
} as const;

/**
 * Type definitions for pattern access
 */
export type UiPatternCategory = keyof typeof uiPatterns;
export type SurfacePattern = keyof typeof surfacePatterns;
export type FeedbackPattern = keyof typeof feedbackPatterns;
export type InteractivePattern = keyof typeof interactivePatterns;
export type LayoutPattern = keyof typeof layoutPatterns;

/**
 * Default export for convenience
 */
export default uiPatterns;