/**
 * @module settings-config
 * @description Configuration για το DXF Settings σύστημα
 * Ελέγχει ποιο backend χρησιμοποιείται (Legacy vs Zustand)
 *
 * ⏱️ Timing constants are sourced from DXF_TIMING (ADR-516 SSoT) — no raw
 * timing literal is defined here anymore.
 */

// 🏢 ADR-516: Timing & Latency SSoT
import { DXF_TIMING } from './dxf-timing';

/**
 * Feature flag για ενεργοποίηση του νέου Zustand-based settings system
 *
 * Όταν είναι true:
 * - Χρησιμοποιείται το Zustand store για όλα τα settings
 * - Ενεργοποιείται το νέο DxfSettingsPanel
 * - Canvas integration μέσω SettingsApplier
 *
 * Όταν είναι false (default):
 * - Χρησιμοποιείται το legacy σύστημα με contexts
 * - EntitiesSettings με useConsolidatedSettings
 */
export const USE_ZUSTAND_SETTINGS = true; // Ενεργοποιούμε το νέο σύστημα!

/**
 * Configuration για performance optimizations
 */
export const SETTINGS_PERFORMANCE = {
  // Debounce delay για slider inputs (ms) — ADR-516 SSoT
  DEBOUNCE_DELAY: DXF_TIMING.ui.SETTINGS_DEBOUNCE,

  // Throttle για canvas updates (ms) — ADR-516 SSoT (1 frame @60fps)
  CANVAS_THROTTLE: DXF_TIMING.frame.THROTTLE_60,

  // Batch size για bulk operations
  BATCH_SIZE: 100,

  // Enable React.memo optimizations
  USE_MEMO_OPTIMIZATION: true,

  // Enable lazy loading για panels
  USE_LAZY_LOADING: true
};

/**
 * Configuration για LocalStorage persistence
 */
export const STORAGE_CONFIG = {
  // Key για localStorage
  STORAGE_KEY: 'dxf-settings-v2',

  // Auto-save interval (ms) — ADR-516 SSoT
  AUTO_SAVE_INTERVAL: DXF_TIMING.persist.LOCALSTORAGE_INTERVAL,

  // Enable compression για storage
  USE_COMPRESSION: false,

  // Max storage size (characters)
  MAX_STORAGE_SIZE: 1000000
};

/**
 * Default values configuration
 */
export const DEFAULT_OVERRIDES = {
  // Enable default overrides για specific entities
  ENABLE_DEFAULT_OVERRIDES: true,

  // Auto-apply overrides σε νέα entities
  AUTO_APPLY_TO_NEW: false,

  // Copy overrides όταν γίνεται entity duplication
  COPY_ON_DUPLICATE: true
};

/**
 * UI Configuration
 */
export const UI_CONFIG = {
  // Show advanced settings
  SHOW_ADVANCED: true,

  // Enable keyboard shortcuts
  ENABLE_SHORTCUTS: true,

  // Show tooltips
  SHOW_TOOLTIPS: true,

  // Animation duration (ms) — ADR-516 SSoT
  ANIMATION_DURATION: DXF_TIMING.animation.FADE,

  // Enable dark mode
  DARK_MODE: true
};

/**
 * Debug configuration
 */
export const DEBUG_CONFIG = {
  // Log store changes
  LOG_STORE_CHANGES: false,

  // Log performance metrics
  LOG_PERFORMANCE: false,

  // Show debug panel
  SHOW_DEBUG_PANEL: false,

  // Enable Redux DevTools
  ENABLE_DEVTOOLS: true
};

/**
 * Validation configuration
 */
export const VALIDATION_CONFIG = {
  // Strict validation mode
  STRICT_MODE: true,

  // Validate on change
  VALIDATE_ON_CHANGE: true,

  // Show validation errors
  SHOW_ERRORS: true,

  // Auto-fix invalid values
  AUTO_FIX: true
};

/**
 * Export utility για conditional imports
 */
export function getSettingsImplementation() {
  if (USE_ZUSTAND_SETTINGS) {
    return {
      provider: 'zustand',
      store: () => import('../stores/DxfSettingsStore'),
      panel: () => Promise.resolve({ default: () => null }), // Mock component
      hooks: () => import('../stores/useDxfSettings')
    };
  } else {
    return {
      provider: 'legacy',
      store: null,
      panel: () => import('../ui/components/dxf-settings/settings/special/EntitiesSettings'),
      hooks: () => Promise.resolve({ default: () => ({}) }) // Mock hooks
    };
  }
}