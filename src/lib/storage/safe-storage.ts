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

  // Social platform analytics (ADR-209 Phase 8)
  SOCIAL_PLATFORM_ANALYTICS: 'social_platform_analytics',
} as const;

export type StorageKeyValue = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

// ============================================================================
// SSR-SAFE HELPERS
// ============================================================================

/**
 * Is `localStorage` usable right now? (SSR, private mode, disabled storage, locked quota.)
 *
 * Exported because it is the ONE question every storage wrapper must ask first, and the answer
 * cannot differ per wrapper. It used to exist as a byte-identical private copy in
 * `src/subapps/dxf-viewer/utils/storage-utils.ts` — two probes, one truth (surfaced by CHECK
 * 3.28 / N.18 on 2026-07-29).
 *
 * ⓘ The probe is a real write+remove, not a feature check: Safari private mode exposes
 * `localStorage` and throws only on write. That is why this cannot be reduced to
 * `typeof localStorage !== 'undefined'`.
 */
export function isStorageAvailable(): boolean {
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
export function safeGetItem(key: string, fallback: string): string;
export function safeGetItem<T>(key: string, fallback: T): T;
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

/**
 * SSR-safe bulk removal of every key sharing a prefix. Returns how many were removed.
 *
 * Exists so that "forget an entire namespace" (a versioned key family such as
 * `nestor:floating-panel-geometry:v1:*`) does not require raw `localStorage` enumeration at
 * the call site — this module is the ONE place allowed to touch `localStorage` directly, and
 * a second access path would be exactly the duplication the module exists to prevent.
 *
 * ⚠️ Iterates over a **snapshot** of the key list: removing while walking `localStorage.key(i)`
 * shifts the remaining indices, which silently skips every other match.
 */
export function safeRemoveItemsByPrefix(prefix: string): number {
  if (!isStorageAvailable() || prefix.length === 0) return 0;
  try {
    const matches: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null && key.startsWith(prefix)) matches.push(key);
    }
    for (const key of matches) localStorage.removeItem(key);
    return matches.length;
  } catch {
    return 0;
  }
}
