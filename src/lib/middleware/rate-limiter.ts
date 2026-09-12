/**
 * 🔒 PR-1C: Enterprise Rate Limiter (v2.0 - Upstash Production-Grade)
 *
 * Centralized rate limiting for API endpoints.
 * Production-grade for Vercel/serverless with Upstash Redis.
 *
 * @module lib/middleware/rate-limiter
 * @version 2.0.0
 * @since 2026-01-29 - PR-1C Re-Architecture
 *
 * Architecture:
 * - Sliding window rate limiting (accurate, memory-efficient)
 * - Per-user (companyId+userId) + per-endpoint granularity
 * - Upstash Redis storage (production) / In-memory (development)
 * - Configurable limits per endpoint category
 *
 * @enterprise Local_Protocol compliant:
 * - ZERO hardcoded values (all in rate-limit-config.ts)
 * - Secure keying (companyId+userId, no token substring)
 * - Fail-fast in production if Upstash not configured
 */

import {
  RATE_LIMIT_CONFIG,
  getEndpointCategory as getCategory,
  getCategoryLimit as getLimit,
  buildRateLimitKey,
  type RateLimitCategory,
} from './rate-limit-config';

import {
  getRateLimitStore,
  type RateLimitCheckResult,
} from './rate-limit-store';

import { createModuleLogger } from '@/lib/telemetry';

// =============================================================================
// LOGGER (Centralized - NO console.*)
// =============================================================================

const logger = createModuleLogger('RATE_LIMITER');

// =============================================================================
// RE-EXPORTS FROM CONFIG (for backward compatibility)
// =============================================================================

export { RATE_LIMIT_CONFIG };
export type { RateLimitCategory };

/**
 * Rate limit check result (re-export with additional fields)
 */
export interface RateLimitResult extends RateLimitCheckResult {
  /** Rate limit category applied */
  category: RateLimitCategory;
}

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Get the rate limit category for an endpoint path.
 */
export function getEndpointCategory(path: string): RateLimitCategory {
  return getCategory(path);
}

/**
 * **Όριο με ΔΙΚΟ του παράθυρο** — για «πράξεις ανά στόχο», όχι «αιτήματα ανά καλούντα»
 * (ADR-851: email λογαριασμού ανά παραλήπτη). **Ίδιο** store (Upstash σε παραγωγή), καμία
 * δεύτερη μηχανή· ο καλών φτιάχνει κλειδί **χωρίς** προσωπικά δεδομένα (κατακερματισμένο).
 */
export async function checkQuota(key: string, limit: number, windowMs: number): Promise<RateLimitCheckResult> {
  return getRateLimitStore().check(key, limit, windowMs);
}

/**
 * Get the rate limit for a category.
 */
export function getCategoryLimit(category: RateLimitCategory): number {
  return getLimit(category);
}

/**
 * Check if a request should be rate limited.
 *
 * @param identifier - User identifier (companyId:userId or hashed identifier)
 * @param endpointPath - API endpoint path
 * @param declaredCategory - **Η βαθμίδα που ΔΗΛΩΣΕ η διαδρομή** (ADR-855 Α1). Όταν λείπει,
 *   αποφασίζει ο πίνακας προθεμάτων, όπως πάντα.
 * @returns Rate limit check result
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΤΟ ΤΡΙΤΟ ΟΡΙΣΜΑ — ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (ADR-855, μετρημένο 2026-09-12)
 * ─────────────────────────────────────────────────────────────────────────────
 * Μέχρι σήμερα η κατηγορία έβγαινε **αποκλειστικά** από το `endpointPath`. Το
 * `WithRateLimitOptions.category` δηλωνόταν στον τύπο, το τεκμηρίωνε το PR-1C ως
 * *«Override Auto-Detection»*, το περνούσαν και οι **επτά** wrappers — και **δεν έφτανε
 * ποτέ εδώ**. Δηλαδή οι επτά ήταν η **ίδια** συνάρτηση με επτά ονόματα.
 *
 * Μετρημένο σε **449** διαδρομές: **89** δήλωναν άλλο από ό,τι επιβαλλόταν, και η απόκλιση
 * ήταν **αμφίδρομη** — 65 χαλαρότερες *(`/api/auth/*`, `/api/oauth/*`, `vendor/quote/[token]`,
 * `first-contacts/guest/confirm`, `attendance/qr/validate`: όλα δήλωναν 10 ή 20 και έτρεχαν
 * **60**)* και **24 αυστηρότερες** *(οι 13 `/api/reports/*` ζητούσαν 60 και έπαιρναν **10**)*.
 *
 * ⚠️ **Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ**: δήλωση ⇒ πίνακας ⇒ προεπιλογή. Ο πίνακας **δεν**
 *    καταργείται — καλύπτει τις **77** σιωπηλές διαδρομές και τις χονδρικές πολιτικές
 *    (`/api/admin/*`). Γίνεται **δεύτερη γραμμή**, όχι πρώτη.
 *
 * @example
 * ```typescript
 * // Η διαδρομή δήλωσε: η δήλωση κερδίζει.
 * await checkRateLimit('company123:user456', '/api/reports/financial', 'STANDARD'); // 60
 * // Καμία δήλωση: αποφασίζει ο πίνακας.
 * await checkRateLimit('company123:user456', '/api/reports/financial');             // 10
 * ```
 */
export async function checkRateLimit(
  identifier: string,
  endpointPath: string,
  declaredCategory?: RateLimitCategory
): Promise<RateLimitResult> {
  // ⚠️ `??` και ΠΟΤΕ `||`: μια βαθμίδα είναι πάντα μη-κενή συμβολοσειρά σήμερα, αλλά το `||`
  //    θα έκανε κάθε μελλοντική «κενή» τιμή να πέφτει σιωπηλά στον πίνακα — δηλαδή θα
  //    μετέτρεπε λάθος δήλωση σε **σιωπηλή** προεπιλογή, που είναι όλο το ελάττωμα ξανά.
  const category = declaredCategory ?? getCategory(endpointPath);
  const limit = getLimit(category);
  const windowMs = RATE_LIMIT_CONFIG.WINDOW.MS;

  // Build storage key
  const key = buildRateLimitKey(identifier, endpointPath);

  // Get store and check
  const store = getRateLimitStore();
  const result = await store.check(key, limit, windowMs);

  return {
    ...result,
    category,
  };
}

/**
 * Synchronous version for backward compatibility.
 * Wraps the async version and returns a promise.
 *
 * @deprecated Use the async checkRateLimit instead
 */
export function checkRateLimitSync(
  identifier: string,
  endpointPath: string
): RateLimitResult {
  // For in-memory store, we can provide a sync-like interface
  // by returning a placeholder that will be resolved
  const category = getCategory(endpointPath);
  const limit = getLimit(category);

  logger.warn('checkRateLimitSync is deprecated. Use async checkRateLimit.');

  // Return a "safe" result for sync callers
  // Real check should use async version
  return {
    allowed: true,
    current: 0,
    limit,
    resetMs: RATE_LIMIT_CONFIG.WINDOW.MS,
    category,
  };
}

/**
 * Reset rate limit for a specific identifier+endpoint.
 * Useful for admin operations or testing.
 */
export async function resetRateLimit(
  identifier: string,
  endpointPath: string
): Promise<void> {
  const key = buildRateLimitKey(identifier, endpointPath);
  const store = getRateLimitStore();
  await store.reset(key);
}

/**
 * Reset all rate limits for a user.
 * Note: This only works reliably with in-memory store.
 * For Upstash, use pattern-based deletion.
 */
export async function resetUserRateLimits(identifier: string): Promise<void> {
  // For now, this is a no-op for Upstash
  // A proper implementation would use SCAN + DEL with pattern
  logger.warn('resetUserRateLimits not fully supported with Upstash', {
    identifier,
    suggestion: 'Use resetRateLimit for specific endpoints',
  });
}

/**
 * Get current rate limit count for an identifier+endpoint.
 * For monitoring purposes.
 */
export async function getRateLimitCount(
  identifier: string,
  endpointPath: string
): Promise<number> {
  const key = buildRateLimitKey(identifier, endpointPath);
  const store = getRateLimitStore();
  return store.getCount(key);
}

/**
 * Get rate limit stats (for monitoring).
 * Note: Limited functionality with Upstash (no in-memory stats).
 */
export function getRateLimitStats(): {
  storeType: 'upstash' | 'memory';
  message: string;
} {
  return {
    storeType: process.env.NODE_ENV === 'production' ? 'upstash' : 'memory',
    message: 'For detailed stats, use Upstash dashboard or Redis monitoring.',
  };
}

// =============================================================================
// HTTP RESPONSE HELPERS
// =============================================================================

/**
 * Create rate limit headers for HTTP response.
 */
export function getRateLimitHeaders(
  result: RateLimitResult
): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(Math.max(0, result.limit - result.current)),
    'X-RateLimit-Reset': String(Math.ceil(result.resetMs / 1000)),
    'X-RateLimit-Category': result.category,
  };
}

/**
 * Create 429 Too Many Requests response.
 */
export function createRateLimitResponse(result: RateLimitResult): Response {
  const retryAfter = Math.ceil(result.resetMs / 1000);

  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: `Too many requests. Please wait ${retryAfter} seconds before retrying.`,
      category: result.category,
      limit: result.limit,
      current: result.current,
      retryAfterSeconds: retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
        ...getRateLimitHeaders(result),
      },
    }
  );
}

// =============================================================================
// DEPRECATED FUNCTIONS (for backward compatibility)
// =============================================================================

/**
 * @deprecated Use checkRateLimit with proper async handling
 */
export function cleanupExpiredEntries(): number {
  logger.warn('cleanupExpiredEntries is deprecated. Cleanup is handled automatically by the store.');
  return 0;
}

/**
 * @deprecated Cleanup is automatic
 */
export function startCleanupScheduler(): void {
  logger.warn('startCleanupScheduler is deprecated. Cleanup is handled automatically by the store.');
}

/**
 * @deprecated Cleanup is automatic
 */
export function stopCleanupScheduler(): void {
  logger.warn('stopCleanupScheduler is deprecated. Cleanup is handled automatically by the store.');
}
