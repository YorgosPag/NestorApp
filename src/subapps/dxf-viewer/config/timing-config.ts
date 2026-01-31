/**
 * 🏢 ENTERPRISE TIMING CONSTANTS - ADR-098
 * ============================================
 *
 * Single Source of Truth για setTimeout/setInterval values
 *
 * NOTE: Για comprehensive timing constants, χρησιμοποιείστε επίσης:
 * - PANEL_LAYOUT.TIMING (panel-tokens.ts) - Full UI/Animation timings (~60+ constants)
 *
 * Αυτό το αρχείο περιέχει domain-specific timings για:
 * - INPUT_TIMING: Focus delays
 * - FIELD_TIMING: Field rendering
 * - UI_TIMING: Interaction guards
 * - STORAGE_TIMING: Persistence debounce
 * - COLLABORATION_TIMING: Real-time features
 *
 * RATIONALE:
 * - Eliminates magic numbers (50, 100, 150, 500, 1000, 2000 ms)
 * - Centralized tuning for performance optimization
 * - Consistent timing behavior across the app
 *
 * MIGRATION:
 * - useDynamicInputKeyboard.ts → INPUT_TIMING, FIELD_TIMING
 * - useDxfSettings.ts → STORAGE_TIMING.SETTINGS_DEBOUNCE
 * - CollaborationEngine.ts → COLLABORATION_TIMING
 * - ToolStateStore.ts → UI_TIMING.TOOL_TRANSITION_RESET
 * - useColorMenuState.ts → UI_TIMING.MENU_CLICK_GUARD
 * - useDynamicInputAnchoring.ts → UI_TIMING.ANCHOR_DISPLAY_DURATION
 * - DxfSettingsStore.ts → STORAGE_TIMING.SAVE_STATUS_DISPLAY
 *
 * @see docs/centralized-systems/reference/adr-index.md (ADR-098)
 * @see PANEL_LAYOUT.TIMING (panel-tokens.ts) for UI/Animation timings
 * @created 2026-01-31
 */

// ============================================
// INPUT & FOCUS TIMING
// ============================================

/**
 * Input field focus timing constants
 *
 * RATIONALE:
 * - FOCUS_IMMEDIATE (10ms): Minimal delay for immediate DOM operations
 * - FOCUS_DEFAULT (50ms): Standard focus delay allowing React re-render
 * - FOCUS_AND_SELECT (50ms): Focus + text selection timing
 */
export const INPUT_TIMING = {
  /** Minimal focus delay (10ms) - for immediate focus after DOM ready */
  FOCUS_IMMEDIATE: 10,

  /** Standard focus delay (50ms) - allows React re-render cycle */
  FOCUS_DEFAULT: 50,

  /** Focus and select text delay (50ms) - same as FOCUS_DEFAULT */
  FOCUS_AND_SELECT: 50,
} as const;

// ============================================
// FIELD RENDERING TIMING
// ============================================

/**
 * Field rendering and transition timing
 *
 * RATIONALE:
 * - Circle/Radius/Diameter fields need time to render before focus
 * - 150ms is sufficient for React to mount new field components
 */
export const FIELD_TIMING = {
  /** Field render delay (150ms) - allows field component to mount */
  FIELD_RENDER_DELAY: 150,
} as const;

// ============================================
// UI INTERACTION TIMING
// ============================================

/**
 * UI interaction timing constants
 *
 * RATIONALE:
 * - MENU_CLICK_GUARD (100ms): Prevents immediate close after menu open
 * - TOOL_TRANSITION_RESET (50ms): Brief delay for tool state transition
 * - ANCHOR_DISPLAY_DURATION (1000ms): Yellow highlight visibility duration
 */
export const UI_TIMING = {
  /** Click-outside guard delay (100ms) - prevents immediate menu close */
  MENU_CLICK_GUARD: 100,

  /** Tool transition reset delay (50ms) - state cleanup after tool change */
  TOOL_TRANSITION_RESET: 50,

  /** Anchor highlight display duration (1000ms / 1s) - yellow coordinate highlight */
  ANCHOR_DISPLAY_DURATION: 1000,
} as const;

// ============================================
// STORAGE & PERSISTENCE TIMING
// ============================================

/**
 * Storage and persistence timing constants
 *
 * RATIONALE:
 * - SETTINGS_DEBOUNCE (150ms): Prevents excessive saves during slider drag
 * - OVERLAY_DEBOUNCE (500ms): Overlay state saves (less frequent)
 * - SAVE_STATUS_DISPLAY (2000ms): "Saved" message visibility duration
 */
export const STORAGE_TIMING = {
  /** Settings debounce delay (150ms) - for slider/input changes */
  SETTINGS_DEBOUNCE: 150,

  /** Overlay state debounce (500ms) - less frequent saves */
  OVERLAY_DEBOUNCE: 500,

  /** Save status display duration (2000ms / 2s) - "Saved" message visibility */
  SAVE_STATUS_DISPLAY: 2000,
} as const;

// ============================================
// COLLABORATION TIMING
// ============================================

/**
 * Collaboration system timing constants
 *
 * RATIONALE:
 * - CONNECTION_DELAY (500ms): Mock WebSocket connection time for demo
 * - CURSOR_UPDATE_INTERVAL (100ms): 10 FPS cursor position updates
 */
export const COLLABORATION_TIMING = {
  /** Mock connection delay (500ms) - simulates WebSocket handshake */
  CONNECTION_DELAY: 500,

  /** Cursor update interval (100ms) - 10 FPS for smooth cursor tracking */
  CURSOR_UPDATE_INTERVAL: 100,
} as const;

// ============================================
// COMBINED CONFIG
// ============================================

/**
 * Complete timing configuration
 *
 * USE THIS for full configuration access
 */
export const TIMING_CONFIG = {
  input: INPUT_TIMING,
  field: FIELD_TIMING,
  ui: UI_TIMING,
  storage: STORAGE_TIMING,
  collaboration: COLLABORATION_TIMING,
} as const;

// ============================================
// TYPE EXPORTS
// ============================================

/** Input timing type */
export type InputTiming = typeof INPUT_TIMING;

/** Field timing type */
export type FieldTiming = typeof FIELD_TIMING;

/** UI timing type */
export type UiTiming = typeof UI_TIMING;

/** Storage timing type */
export type StorageTiming = typeof STORAGE_TIMING;

/** Collaboration timing type */
export type CollaborationTiming = typeof COLLABORATION_TIMING;

/** Complete timing config type */
export type TimingConfig = typeof TIMING_CONFIG;
