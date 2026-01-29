/**
 * 🔒 Enterprise Middleware Module (v2.0 - Upstash Production-Grade)
 *
 * Centralized exports for API middleware.
 * Production-grade for Vercel/serverless with Upstash Redis.
 *
 * @module lib/middleware
 * @version 2.0.0
 * @since 2026-01-29 - PR-1C Re-Architecture
 */

// =============================================================================
// RATE LIMIT CONFIGURATION (SSoT)
// =============================================================================

export {
  RATE_LIMIT_CONFIG,
  UPSTASH_ENV_KEYS,
  RATE_LIMIT_KEY_PREFIXES,
  RATE_LIMIT_WINDOW,
  RATE_LIMIT_CATEGORIES,
  ENDPOINT_CATEGORY_MAPPINGS,
  DEFAULT_RATE_LIMIT_CATEGORY,
  getRateLimitStoreType,
  getUpstashConfig,
  getCategoryLimit,
  getEndpointCategory,
  buildRateLimitKey,
  type RateLimitCategory,
  type RateLimitStoreType,
} from './rate-limit-config';

// =============================================================================
// RATE LIMIT STORE
// =============================================================================

export {
  getRateLimitStore,
  resetStoreInstance,
  type RateLimitStore,
  type RateLimitCheckResult,
} from './rate-limit-store';

// =============================================================================
// RATE LIMITING CORE
// =============================================================================

export {
  // Core functions
  checkRateLimit,
  resetRateLimit,
  resetUserRateLimits,
  getRateLimitCount,
  getRateLimitStats,

  // HTTP helpers
  getRateLimitHeaders,
  createRateLimitResponse,

  // Types
  type RateLimitResult,

  // Deprecated (backward compatibility)
  checkRateLimitSync,
  cleanupExpiredEntries,
  startCleanupScheduler,
  stopCleanupScheduler,
} from './rate-limiter';

// =============================================================================
// RATE LIMIT WRAPPERS
// =============================================================================

export {
  // Main wrapper
  withRateLimit,

  // Pre-configured wrappers
  withHighRateLimit,
  withStandardRateLimit,
  withSensitiveRateLimit,
  withHeavyRateLimit,
  withWebhookRateLimit,
  withTelegramRateLimit,

  // Types
  type WithRateLimitOptions,
} from './with-rate-limit';
