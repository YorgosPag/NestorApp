/**
 * @module settings-config
 * @description Configuration για το DXF Settings σύστημα
 * Ελέγχει ποιο backend χρησιμοποιείται (Legacy vs Zustand)
 */

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
  // Debounce delay για slider inputs (ms)
  DEBOUNCE_DELAY: 150,

  // Throttle για canvas updates (ms)
  CANVAS_THROTTLE: 16, // 60 FPS

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

  // Auto-save interval (ms)
  AUTO_SAVE_INTERVAL: 5000,

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

  // Animation duration (ms)
  ANIMATION_DURATION: 200,

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
      panel: () => import('../ui/components/dxf-settings/DxfSettingsPanel'),
      hooks: () => import('../stores/useDxfSettings')
    };
  } else {
    return {
      provider: 'legacy',
      store: null,
      panel: () => import('../ui/components/dxf-settings/settings/special/EntitiesSettings'),
      hooks: () => import('../ui/hooks/useConsolidatedSettings')
    };
  }
}