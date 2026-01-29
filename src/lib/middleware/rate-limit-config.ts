/**
 * 🔒 PR-1C: Rate Limit Configuration (SSoT)
 *
 * Single Source of Truth for all rate limiting configuration.
 * Production-grade for Vercel/serverless with Upstash Redis.
 *
 * @module lib/middleware/rate-limit-config
 * @version 2.0.0
 * @since 2026-01-29 - PR-1C Re-Architecture
 *
 * @enterprise Local_Protocol compliant:
 * - ZERO hardcoded values in code
 * - All config centralized here
 * - Environment-aware (dev/staging/production)
 */

import { getCurrentRuntimeEnvironment } from '@/config/environment-security-config';

// =============================================================================
// ENVIRONMENT VARIABLES (SSoT)
// =============================================================================

/**
 * Upstash Redis environment variable names.
 * All env keys centralized here - no scattered strings.
 */
export const UPSTASH_ENV_KEYS = {
  /** Upstash Redis REST URL */
  URL: 'UPSTASH_REDIS_REST_URL',
  /** Upstash Redis REST Token */
  TOKEN: 'UPSTASH_REDIS_REST_TOKEN',
} as const;

/**
 * Rate limit key prefixes for Redis.
 * Enables easy debugging and namespace isolation.
 */
export const RATE_LIMIT_KEY_PREFIXES = {
  /** Prefix for all rate limit keys */
  BASE: 'nestor:ratelimit',
  /** Prefix for authenticated user rate limits */
  USER: 'user',
  /** Prefix for anonymous/IP-based rate limits */
  ANON: 'anon',
} as const;

// =============================================================================
// RATE LIMIT POLICY (SSoT)
// =============================================================================

/**
 * Rate limit window configuration.
 */
export const RATE_LIMIT_WINDOW = {
  /** Window size in milliseconds (1 minute) */
  MS: 60_000,
  /** Window size in seconds (for Upstash) */
  SECONDS: 60,
} as const;

/**
 * Rate limit categories and their limits (requests per window).
 *
 * @enterprise Adjust based on production monitoring
 */
export const RATE_LIMIT_CATEGORIES = {
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
  /** Telegram bot endpoints */
  TELEGRAM: 15,
} as const;

/**
 * Rate limit category type
 */
export type RateLimitCategory = keyof typeof RATE_LIMIT_CATEGORIES;

/**
 * Endpoint path to category mappings.
 * Used for auto-detection of rate limit category.
 */
export const ENDPOINT_CATEGORY_MAPPINGS: Record<string, RateLimitCategory> = {
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

  // Telegram - TELEGRAM
  '/api/communications/webhooks/telegram': 'TELEGRAM',
} as const;

/**
 * Default category for unmapped endpoints
 */
export const DEFAULT_RATE_LIMIT_CATEGORY: RateLimitCategory = 'STANDARD';

// =============================================================================
// STORE CONFIGURATION
// =============================================================================

/**
 * Rate limit store type.
 */
export type RateLimitStoreType = 'upstash' | 'memory';

/**
 * Get the appropriate store type based on environment.
 *
 * - Production: Upstash (required, fail-fast if missing)
 * - Development/Test: Memory (with optional Upstash override)
 */
export function getRateLimitStoreType(): RateLimitStoreType {
  const env = getCurrentRuntimeEnvironment();

  // Production MUST use Upstash
  if (env === 'production') {
    return 'upstash';
  }

  // Staging should use Upstash if available
  if (env === 'staging') {
    const hasUpstash = Boolean(
      process.env[UPSTASH_ENV_KEYS.URL] && process.env[UPSTASH_ENV_KEYS.TOKEN]
    );
    return hasUpstash ? 'upstash' : 'memory';
  }

  // Development/Test: Use memory by default, Upstash if explicitly configured
  const forceUpstash = process.env.RATE_LIMIT_FORCE_UPSTASH === 'true';
  if (forceUpstash) {
    return 'upstash';
  }

  return 'memory';
}

/**
 * Get Upstash configuration from environment.
 *
 * @throws Error in production if Upstash is not configured
 */
export function getUpstashConfig(): { url: string; token: string } | null {
  const url = process.env[UPSTASH_ENV_KEYS.URL];
  const token = process.env[UPSTASH_ENV_KEYS.TOKEN];

  if (!url || !token) {
    const env = getCurrentRuntimeEnvironment();

    // Fail-fast in production
    if (env === 'production') {
      throw new Error(
        `[RATE_LIMIT] CRITICAL: Upstash Redis not configured in production. ` +
          `Set ${UPSTASH_ENV_KEYS.URL} and ${UPSTASH_ENV_KEYS.TOKEN} environment variables.`
      );
    }

    return null;
  }

  return { url, token };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get rate limit for a category.
 */
export function getCategoryLimit(category: RateLimitCategory): number {
  return RATE_LIMIT_CATEGORIES[category];
}

/**
 * Get category for an endpoint path.
 */
export function getEndpointCategory(path: string): RateLimitCategory {
  // Check for prefix matches
  for (const [pattern, category] of Object.entries(ENDPOINT_CATEGORY_MAPPINGS)) {
    if (path.startsWith(pattern)) {
      return category;
    }
  }

  return DEFAULT_RATE_LIMIT_CATEGORY;
}

/**
 * Build a rate limit key for storage.
 *
 * @param identifier - User identifier (companyId:userId or hashed IP)
 * @param endpoint - API endpoint path
 * @returns Namespaced key for storage
 */
export function buildRateLimitKey(identifier: string, endpoint: string): string {
  const base = RATE_LIMIT_KEY_PREFIXES.BASE;
  // Normalize endpoint (remove query params, trailing slashes)
  const normalizedEndpoint = endpoint.split('?')[0].replace(/\/+$/, '');
  // Create a safe key (replace special chars)
  const safeEndpoint = normalizedEndpoint.replace(/[^a-zA-Z0-9]/g, '_');

  return `${base}:${identifier}:${safeEndpoint}`;
}

// =============================================================================
// EXPORTS
// =============================================================================

export const RATE_LIMIT_CONFIG = {
  WINDOW: RATE_LIMIT_WINDOW,
  CATEGORIES: RATE_LIMIT_CATEGORIES,
  ENDPOINT_MAPPINGS: ENDPOINT_CATEGORY_MAPPINGS,
  DEFAULT_CATEGORY: DEFAULT_RATE_LIMIT_CATEGORY,
  KEY_PREFIXES: RATE_LIMIT_KEY_PREFIXES,
  ENV_KEYS: UPSTASH_ENV_KEYS,
} as const;
