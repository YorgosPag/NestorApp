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

import { DXF_TIMING } from '../config/dxf-timing';

/**
 * Enterprise provider configuration constants
 */
export const ENTERPRISE_CONSTANTS = {
  /** Maximum render count *within a single burst window* before the infinite
   * loop warning fires. React 18 StrictMode + deep provider nesting can
   * legitimately reach 50+ renders on init (2× StrictMode × N state
   * transitions). A true loop produces >100 renders inside one
   * RENDER_LOOP_WINDOW_MS window; normal interaction spreads renders across
   * many windows and never trips. */
  RENDER_LOOP_THRESHOLD: 100,

  /** Burst window (ms) for the render-loop detector. The render counter is
   * reset whenever this window elapses without crossing RENDER_LOOP_THRESHOLD,
   * so legitimate long-session re-renders (floor changes, settings edits,
   * hydration) never accumulate into a false "INFINITE LOOP DETECTED". Only a
   * genuine tight loop can reach the threshold before the window resets. */
  RENDER_LOOP_WINDOW_MS: DXF_TIMING.lifecycle.RENDER_LOOP_WINDOW, // ADR-516

  /** Auto-save debounce delay in milliseconds (ADR-516 → DXF_TIMING.persist.ENTITY_AUTOSAVE). */
  AUTO_SAVE_DEBOUNCE_MS: DXF_TIMING.persist.ENTITY_AUTOSAVE,

  /** Default viewer mode for backward compatibility */
  DEFAULT_VIEWER_MODE: 'normal' as const,

  /**
   * Default layer for old API calls
   * Settings layer (general/specific/overrides) - default to general
   */
  DEFAULT_SETTINGS_LAYER: 'general' as const
} as const;

/**
 * Type-safe constant access
 */
export type EnterpriseConstants = typeof ENTERPRISE_CONSTANTS;
