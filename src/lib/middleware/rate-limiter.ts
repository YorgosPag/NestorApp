/**
 * 🔒 PR-1C: Enterprise Rate Limiter
 *
 * Centralized rate limiting for API endpoints.
 * Prevents DoS attacks and resource abuse.
 *
 * @module lib/middleware/rate-limiter
 * @version 1.0.0
 * @since 2026-01-29 - Security Gate Phase 1 (PR-1C)
 *
 * Architecture:
 * - Sliding window rate limiting (more accurate than token bucket)
 * - Per-user (UID) + per-endpoint granularity
 * - In-memory storage (suitable for single-instance deployments)
 * - Configurable limits per endpoint category
 *
 * @enterprise Follows Local_Protocol: NO hardcoded values, centralized config
 */

// =============================================================================
// CONFIGURATION (Centralized - NO hardcoded values in code)
// =============================================================================

/**
 * Rate limit configuration per endpoint category.
 * Values are requests per window.
 *
 * @enterprise Adjust these values based on production monitoring
 */
export const RATE_LIMIT_CONFIG = {
  /** Window size in milliseconds */
  WINDOW_MS: 60_000, // 1 minute

  /** Default limits per window (requests/minute) */
  LIMITS: {
    /** High-frequency endpoints (list, search) */
    HIGH: 100,
    /** Standard CRUD operations */
    STANDARD: 60,
    /** Sensitive operations (admin, financial) */
    SENSITIVE: 20,
    /** Heavy operations (reports, exports) */
    HEAVY: 10,
    /** Webhook endpoints (external) */
    WEBHOOK: 30,
  },

  /** Endpoint category mappings */
  ENDPOINT_CATEGORIES: {
    // Admin endpoints - SENSITIVE
    '/api/admin': 'SENSITIVE',
    '/api/admin/buildings': 'SENSITIVE',
    '/api/admin/templates': 'SENSITIVE',

    // Search endpoints - HIGH
    '/api/search': 'HIGH',
    '/api/projects/list': 'HIGH',
    '/api/contacts/list': 'HIGH',

    // Report endpoints - HEAVY
    '/api/reports': 'HEAVY',
    '/api/export': 'HEAVY',
    '/api/analytics': 'HEAVY',

    // Webhook endpoints - WEBHOOK
    '/api/communications/webhooks': 'WEBHOOK',

    // Default for unlisted endpoints - STANDARD
    DEFAULT: 'STANDARD',
  },
} as const;

// =============================================================================
// TYPES
// =============================================================================

/**
 * Rate limit category keys
 */
export type RateLimitCategory = keyof typeof RATE_LIMIT_CONFIG.LIMITS;

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Current request count in window */
  current: number;
  /** Maximum allowed requests */
  limit: number;
  /** Milliseconds until window resets */
  resetMs: number;
  /** Rate limit category applied */
  category: RateLimitCategory;
}

/**
 * Rate limiter entry for a user+endpoint
 */
interface RateLimitEntry {
  /** Timestamps of requests in current window */
  timestamps: number[];
  /** Category for this endpoint */
  category: RateLimitCategory;
}

// =============================================================================
// IN-MEMORY STORE
// =============================================================================

/**
 * In-memory rate limit store.
 * Key format: `${userId}:${endpointPath}`
 *
 * @note For multi-instance deployments, replace with Redis
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Cleanup interval reference for memory management
 */
let cleanupInterval: NodeJS.Timeout | null = null;

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Get the rate limit category for an endpoint path.
 */
export function getEndpointCategory(path: string): RateLimitCategory {
  const categories = RATE_LIMIT_CONFIG.ENDPOINT_CATEGORIES;

  // Check for exact match first
  for (const [pattern, category] of Object.entries(categories)) {
    if (pattern === 'DEFAULT') continue;
    if (path.startsWith(pattern)) {
      return category as RateLimitCategory;
    }
  }

  return 'STANDARD';
}

/**
 * Get the rate limit for a category.
 */
export function getCategoryLimit(category: RateLimitCategory): number {
  return RATE_LIMIT_CONFIG.LIMITS[category];
}

/**
 * Check if a request should be rate limited.
 *
 * @param userId - User's unique identifier (UID)
 * @param endpointPath - API endpoint path
 * @returns Rate limit check result
 *
 * @example
 * ```typescript
 * const result = checkRateLimit('user-123', '/api/projects/list');
 * if (!result.allowed) {
 *   return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
 * }
 * ```
 */
export function checkRateLimit(
  userId: string,
  endpointPath: string
): RateLimitResult {
  const now = Date.now();
  const windowMs = RATE_LIMIT_CONFIG.WINDOW_MS;
  const windowStart = now - windowMs;

  // Generate storage key
  const key = `${userId}:${endpointPath}`;

  // Get or create entry
  let entry = rateLimitStore.get(key);
  const category = getEndpointCategory(endpointPath);
  const limit = getCategoryLimit(category);

  if (!entry) {
    entry = {
      timestamps: [],
      category,
    };
    rateLimitStore.set(key, entry);
  }

  // Remove timestamps outside the window (sliding window cleanup)
  entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);

  // Check if limit exceeded
  const current = entry.timestamps.length;
  const allowed = current < limit;

  // If allowed, record this request
  if (allowed) {
    entry.timestamps.push(now);
  }

  // Calculate reset time (when oldest request falls out of window)
  const oldestTimestamp = entry.timestamps[0] || now;
  const resetMs = Math.max(0, oldestTimestamp + windowMs - now);

  return {
    allowed,
    current: allowed ? current + 1 : current,
    limit,
    resetMs,
    category,
  };
}

/**
 * Reset rate limit for a specific user+endpoint.
 * Useful for admin operations or testing.
 */
export function resetRateLimit(userId: string, endpointPath: string): void {
  const key = `${userId}:${endpointPath}`;
  rateLimitStore.delete(key);
}

/**
 * Reset all rate limits for a user.
 */
export function resetUserRateLimits(userId: string): void {
  for (const key of rateLimitStore.keys()) {
    if (key.startsWith(`${userId}:`)) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Get current rate limit stats (for monitoring).
 */
export function getRateLimitStats(): {
  totalEntries: number;
  entriesByCategory: Record<RateLimitCategory, number>;
} {
  const entriesByCategory: Record<RateLimitCategory, number> = {
    HIGH: 0,
    STANDARD: 0,
    SENSITIVE: 0,
    HEAVY: 0,
    WEBHOOK: 0,
  };

  for (const entry of rateLimitStore.values()) {
    entriesByCategory[entry.category]++;
  }

  return {
    totalEntries: rateLimitStore.size,
    entriesByCategory,
  };
}

// =============================================================================
// MEMORY MANAGEMENT
// =============================================================================

/**
 * Clean up expired entries from the store.
 * Called periodically to prevent memory leaks.
 */
export function cleanupExpiredEntries(): number {
  const now = Date.now();
  const windowMs = RATE_LIMIT_CONFIG.WINDOW_MS;
  const windowStart = now - windowMs;
  let cleaned = 0;

  for (const [key, entry] of rateLimitStore.entries()) {
    // Remove timestamps outside window
    entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);

    // Remove entry if no timestamps remain
    if (entry.timestamps.length === 0) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Start periodic cleanup (call once at app startup).
 * Cleans expired entries every minute.
 */
export function startCleanupScheduler(): void {
  if (cleanupInterval) return; // Already started

  cleanupInterval = setInterval(() => {
    const cleaned = cleanupExpiredEntries();
    if (cleaned > 0) {
      console.log(`[RATE_LIMITER] Cleaned ${cleaned} expired entries`);
    }
  }, 60_000); // Every minute
}

/**
 * Stop cleanup scheduler (for testing or shutdown).
 */
export function stopCleanupScheduler(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// =============================================================================
// HTTP RESPONSE HELPERS
// =============================================================================

/**
 * Create rate limit headers for HTTP response.
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
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
// START CLEANUP ON MODULE LOAD (Server-side only)
// =============================================================================

if (typeof window === 'undefined') {
  startCleanupScheduler();
}
