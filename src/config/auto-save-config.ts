/**
 * @file auto-save-config.ts — Auto-Save Timing Constants
 * @module config/auto-save-config
 *
 * 🏢 ENTERPRISE: ADR-248 — Centralized Auto-Save System
 *
 * Single Source of Truth for all auto-save timing constants.
 * Replaces magic numbers scattered across 8+ components.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-248-centralized-auto-save.md
 * @see src/subapps/dxf-viewer/config/timing-config.ts (DXF-specific timings — orthogonal)
 * @created 2026-03-19
 */

/**
 * Auto-save timing constants for application forms and settings.
 *
 * RATIONALE:
 * - FORM_DEBOUNCE (2000ms): Standard form debounce matching Google Docs pattern
 * - SETTINGS_DEBOUNCE (500ms): Faster for user preferences / toggles
 * - INSTANT (0ms): No debounce for select/dropdown immediate saves
 * - STATUS_RESET (3000ms): "Saved" message stays visible long enough to notice
 * - ERROR_RESET (5000ms): Error messages stay longer for readability
 * - RETRY_DELAY (1000ms): Brief delay before retry to avoid hammering
 * - MAX_RETRIES (2): Enough to handle transient network errors
 */
export const AUTO_SAVE_TIMING = {
  /** Form debounce (2000ms) — Building/Project/Contact forms */
  FORM_DEBOUNCE: 2000,

  /** Settings debounce (500ms) — User preferences, toggles */
  SETTINGS_DEBOUNCE: 500,

  /** Instant save (0ms) — Select/dropdown immediate changes */
  INSTANT: 0,

  /** "Saved" message display duration (3000ms) */
  STATUS_RESET: 3000,

  /** Error message display duration (5000ms) */
  ERROR_RESET: 5000,

  /** Delay before automatic retry (1000ms) */
  RETRY_DELAY: 1000,

  /** Maximum automatic retry attempts */
  MAX_RETRIES: 2,
} as const;

/** Type for AUTO_SAVE_TIMING */
export type AutoSaveTiming = typeof AUTO_SAVE_TIMING;
