/**
 * 🏢 ENTERPRISE TIMING CONSTANTS — ADR-098 (now a FACADE over ADR-516)
 * ============================================
 *
 * ⚠️ SINGLE SOURCE OF TRUTH MOVED: as of ADR-516 (2026-06-24) the canonical
 * owner of every timing value is `config/dxf-timing.ts → DXF_TIMING`.
 * This module is kept as a backward-compatible facade so existing consumers
 * (useDynamicInputKeyboard, useDxfSettings, CollaborationEngine, ToolStateStore,
 * useColorMenuState, …) keep working unchanged. Every value below is a reference
 * into DXF_TIMING — no number is defined here anymore.
 *
 * New code: import DXF_TIMING directly. These aliases will be migrated and
 * removed in ADR-516 Phase 2.
 *
 * @see config/dxf-timing.ts (DXF_TIMING — the SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-516-timing-latency-ssot.md
 * @created 2026-01-31  @facade-since 2026-06-24 (ADR-516)
 */

import { DXF_TIMING } from './dxf-timing';

// ============================================
// INPUT & FOCUS TIMING (→ DXF_TIMING.ui)
// ============================================
export const INPUT_TIMING = {
  /** Minimal focus delay (10ms) - for immediate focus after DOM ready */
  FOCUS_IMMEDIATE: DXF_TIMING.ui.FOCUS_IMMEDIATE,
  /** Standard focus delay (50ms) - allows React re-render cycle */
  FOCUS_DEFAULT: DXF_TIMING.ui.FOCUS_DEFAULT,
  /** Focus and select text delay (50ms) - same as FOCUS_DEFAULT */
  FOCUS_AND_SELECT: DXF_TIMING.ui.FOCUS_DEFAULT,
} as const;

// ============================================
// FIELD RENDERING TIMING (→ DXF_TIMING.ui)
// ============================================
export const FIELD_TIMING = {
  /** Field render delay (150ms) - allows field component to mount */
  FIELD_RENDER_DELAY: DXF_TIMING.ui.FIELD_RENDER_DELAY,
} as const;

// ============================================
// UI INTERACTION TIMING (→ DXF_TIMING.ui / .animation)
// ============================================
export const UI_TIMING = {
  /** Click-outside guard delay (100ms) - prevents immediate menu close */
  MENU_CLICK_GUARD: DXF_TIMING.ui.MENU_CLICK_GUARD,
  /** Tool transition reset delay (50ms) - state cleanup after tool change */
  TOOL_TRANSITION_RESET: DXF_TIMING.ui.TOOL_TRANSITION,
  /** Anchor highlight display duration (1000ms / 1s) - yellow coordinate highlight */
  ANCHOR_DISPLAY_DURATION: DXF_TIMING.animation.ANCHOR_DISPLAY,
  /**
   * Escape reactivation lock (200ms) - after ESC cancels a tool, ignore any
   * selectTool() calls for the same tool within this window (ADR-362 hotfix).
   */
  ESCAPE_REACTIVATION_LOCK: DXF_TIMING.ui.ESCAPE_REACTIVATION_LOCK,
} as const;

// ============================================
// STORAGE & PERSISTENCE TIMING (→ DXF_TIMING.ui / .persist)
// ============================================
export const STORAGE_TIMING = {
  /** Settings debounce delay (150ms) - for slider/input changes */
  SETTINGS_DEBOUNCE: DXF_TIMING.ui.SETTINGS_DEBOUNCE,
  /** Overlay state debounce (500ms) - less frequent saves */
  OVERLAY_DEBOUNCE: DXF_TIMING.persist.SETTINGS,
  /** Save status display duration (2000ms / 2s) - "Saved" message visibility */
  SAVE_STATUS_DISPLAY: DXF_TIMING.persist.SAVE_STATUS_DISPLAY,
  /** Scene auto-save debounce (2000ms / 2s) - Firestore write throttling */
  SCENE_AUTOSAVE_DEBOUNCE: DXF_TIMING.persist.SCENE_AUTOSAVE,
} as const;

// ============================================
// COLLABORATION TIMING (→ DXF_TIMING.lifecycle / .frame)
// ============================================
export const COLLABORATION_TIMING = {
  /** Mock connection delay (500ms) - simulates WebSocket handshake */
  CONNECTION_DELAY: DXF_TIMING.lifecycle.CONNECTION_DELAY,
  /** Cursor update interval (100ms) - 10 FPS for smooth cursor tracking */
  CURSOR_UPDATE_INTERVAL: DXF_TIMING.frame.COLLAB_CURSOR_OUTER,
} as const;

// ============================================
// CACHE TIMING - ADR-113 (→ DXF_TIMING.lifecycle)
// ============================================
export const CACHE_TIMING = {
  /** Default cache TTL (300000ms / 5 minutes) - standard cache lifetime */
  DEFAULT_TTL_MS: DXF_TIMING.lifecycle.CACHE_TTL,
  /** Extended cache TTL (600000ms / 10 minutes) - for global/singleton caches */
  EXTENDED_TTL_MS: DXF_TIMING.lifecycle.CACHE_TTL_EXTENDED,
  /** Cleanup interval (60000ms / 1 minute) - periodic cache cleanup */
  CLEANUP_INTERVAL_MS: DXF_TIMING.lifecycle.CACHE_CLEANUP,
} as const;

// ============================================
// COMBINED CONFIG
// ============================================
/** Complete timing configuration (facade view). Prefer DXF_TIMING in new code. */
export const TIMING_CONFIG = {
  input: INPUT_TIMING,
  field: FIELD_TIMING,
  ui: UI_TIMING,
  storage: STORAGE_TIMING,
  collaboration: COLLABORATION_TIMING,
  cache: CACHE_TIMING,
} as const;

// ============================================
// TYPE EXPORTS
// ============================================
export type InputTiming = typeof INPUT_TIMING;
export type FieldTiming = typeof FIELD_TIMING;
export type UiTiming = typeof UI_TIMING;
export type StorageTiming = typeof STORAGE_TIMING;
export type CollaborationTiming = typeof COLLABORATION_TIMING;
export type CacheTiming = typeof CACHE_TIMING;
export type TimingConfig = typeof TIMING_CONFIG;
