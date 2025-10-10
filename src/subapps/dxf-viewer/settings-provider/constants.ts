/**
 * @file Enterprise DXF Settings - Constants
 * @module settings-provider/constants
 *
 * ✅ ENTERPRISE: Named constants (no magic numbers)
 *
 * All configurable values are extracted to named constants for:
 * - Readability: Clear semantic meaning
 * - Maintainability: Single source of truth
 * - Testability: Easy to override in tests
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-09
 */

/**
 * Enterprise provider configuration constants
 */
export const ENTERPRISE_CONSTANTS = {
  /** Maximum render count before infinite loop warning */
  RENDER_LOOP_THRESHOLD: 50,

  /** Auto-save debounce delay in milliseconds */
  AUTO_SAVE_DEBOUNCE_MS: 500,

  /** Default viewer mode for backward compatibility */
  DEFAULT_VIEWER_MODE: 'normal' as const,

  /** Default layer for old API calls */
  DEFAULT_LAYER: 'general' as const
} as const;

/**
 * Type-safe constant access
 */
export type EnterpriseConstants = typeof ENTERPRISE_CONSTANTS;
