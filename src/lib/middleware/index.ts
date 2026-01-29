/**
 * 🔒 Enterprise Middleware Module
 *
 * Centralized exports for API middleware.
 *
 * @module lib/middleware
 * @version 1.0.0
 * @since 2026-01-29 - Security Gate Phase 1
 */

// =============================================================================
// RATE LIMITING (PR-1C)
// =============================================================================

export {
  // Core functions
  checkRateLimit,
  resetRateLimit,
  resetUserRateLimits,
  getRateLimitStats,
  cleanupExpiredEntries,

  // HTTP helpers
  getRateLimitHeaders,
  createRateLimitResponse,

  // Configuration
  getEndpointCategory,
  getCategoryLimit,
  RATE_LIMIT_CONFIG,

  // Types
  type RateLimitResult,
  type RateLimitCategory,
} from './rate-limiter';

export {
  // Main wrapper
  withRateLimit,

  // Pre-configured wrappers
  withHighRateLimit,
  withStandardRateLimit,
  withSensitiveRateLimit,
  withHeavyRateLimit,
  withWebhookRateLimit,

  // Types
  type WithRateLimitOptions,
} from './with-rate-limit';
