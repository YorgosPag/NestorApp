/**
 * =============================================================================
 * SAFE STORAGE - SSR-SAFE localStorage UTILITIES
 * =============================================================================
 *
 * Centralized, SSR-safe localStorage operations with error handling
 * and a key registry to prevent typos and scattered magic strings.
 *
 * @module lib/storage/safe-storage
 */

// ============================================================================
// STORAGE KEYS REGISTRY (Main App)
// ============================================================================

export const STORAGE_KEYS = {
  // Language / i18n
  PREFERRED_LANGUAGE: 'preferred-language',

  // Workspace
  ACTIVE_WORKSPACE: 'nestor_active_workspace_id',

  // User type
  USER_TYPE: 'geo-alert-user-type',

  // Error tracking
  ERROR_TRACKING_OPT_OUT: 'geo_alert_error_tracking_opt_out',
  ERROR_TRACKING_CONSENT: 'geo_alert_error_tracking_consent',
  ERROR_LOG: 'geo_alert_errors',

  // Product tour (prefix — append tour ID)
  PRODUCT_TOUR_PREFIX: 'pagonis_tour_dismissed_',

  // Auth (prefix — append uid)
  AUTH_GIVEN_NAME_PREFIX: 'givenName_',
  AUTH_FAMILY_NAME_PREFIX: 'familyName_',
  AUTH_PROFILE_COMPLETE_PREFIX: 'profile_complete_',

  // Legacy user blob
  USER: 'user',
} as const;

export type StorageKeyValue = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

// ============================================================================
// SSR-SAFE HELPERS
// ============================================================================

function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * SSR-safe localStorage.getItem with JSON deserialization and fallback.
 * For plain strings, pass a string fallback. For objects/arrays, the value
 * is automatically JSON.parsed.
 */
export function safeGetItem<T>(key: string, fallback: T): T {
  if (!isStorageAvailable()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;

    // If fallback is a string, return raw string (no JSON parsing)
    if (typeof fallback === 'string') return raw as T;

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * SSR-safe localStorage.setItem with automatic JSON serialization for non-strings.
 * Returns true on success, false on failure (SSR, quota exceeded, etc.).
 */
export function safeSetItem(key: string, value: unknown): boolean {
  if (!isStorageAvailable()) return false;
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return true;
  } catch {
    return false;
  }
}

/**
 * SSR-safe localStorage.removeItem.
 * Returns true on success, false on failure.
 */
export function safeRemoveItem(key: string): boolean {
  if (!isStorageAvailable()) return false;
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
