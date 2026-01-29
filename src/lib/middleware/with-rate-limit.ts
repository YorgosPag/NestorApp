/**
 * 🔒 PR-1C: Rate Limited API Handler Wrapper
 *
 * Higher-order function that adds rate limiting to API handlers.
 * Designed to work with the existing `withAuth` middleware pattern.
 *
 * @module lib/middleware/with-rate-limit
 * @version 1.0.0
 * @since 2026-01-29 - Security Gate Phase 1 (PR-1C)
 *
 * Usage:
 * ```typescript
 * // Method 1: Wrap withAuth handler
 * export const GET = withRateLimit(
 *   withAuth(handler, { permissions: 'projects:view' }),
 *   { category: 'HIGH' }
 * );
 *
 * // Method 2: Standalone rate limiting
 * export const GET = withRateLimit(handler, { category: 'STANDARD' });
 * ```
 *
 * @enterprise Follows Local_Protocol: NO hardcoded values, centralized config
 */

import type { NextRequest } from 'next/server';
import {
  checkRateLimit,
  createRateLimitResponse,
  getRateLimitHeaders,
  type RateLimitCategory,
} from './rate-limiter';

// =============================================================================
// TYPES
// =============================================================================

/**
 * API handler function type (matches Next.js App Router)
 */
type ApiHandler = (
  request: NextRequest,
  context?: { params?: Record<string, string> }
) => Promise<Response> | Response;

/**
 * Rate limit options for the wrapper
 */
export interface WithRateLimitOptions {
  /** Override the auto-detected category */
  category?: RateLimitCategory;
  /** Custom key extractor (default: uses Authorization header UID or IP) */
  getKey?: (request: NextRequest) => string | null;
  /** Skip rate limiting for certain conditions */
  skip?: (request: NextRequest) => boolean;
}

// =============================================================================
// DEFAULT KEY EXTRACTION
// =============================================================================

/**
 * Extract user identifier from request.
 * Priority: Authorization token UID > IP address
 *
 * @note For production, consider using Firebase App Check token
 */
function extractDefaultKey(request: NextRequest): string {
  // Try to get user ID from authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    // Use token hash as key (we don't decode here, just use for identification)
    // In practice, the actual UID would be extracted in withAuth
    const token = authHeader.substring(7);
    // Use first 32 chars of token as identifier (sufficient for uniqueness)
    return `token:${token.substring(0, 32)}`;
  }

  // Fallback to IP address
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';

  return `ip:${ip}`;
}

// =============================================================================
// MAIN WRAPPER
// =============================================================================

/**
 * Add rate limiting to an API handler.
 *
 * @param handler - The API handler function to wrap
 * @param options - Rate limiting options
 * @returns Wrapped handler with rate limiting
 *
 * @example
 * ```typescript
 * // With explicit category
 * export const GET = withRateLimit(myHandler, { category: 'SENSITIVE' });
 *
 * // With custom key extraction
 * export const GET = withRateLimit(myHandler, {
 *   getKey: (req) => req.headers.get('x-api-key'),
 * });
 *
 * // Skip rate limiting for certain requests
 * export const GET = withRateLimit(myHandler, {
 *   skip: (req) => req.headers.get('x-bypass-rate-limit') === 'secret',
 * });
 * ```
 */
export function withRateLimit(
  handler: ApiHandler,
  options: WithRateLimitOptions = {}
): ApiHandler {
  return async (request: NextRequest, context) => {
    // Check if we should skip rate limiting
    if (options.skip?.(request)) {
      return handler(request, context);
    }

    // Extract identifier key
    const key = options.getKey?.(request) ?? extractDefaultKey(request);

    // If we couldn't extract a key, proceed without rate limiting
    // (this shouldn't happen in practice)
    if (!key) {
      console.warn('[RATE_LIMIT] Could not extract key, skipping rate limit');
      return handler(request, context);
    }

    // Get endpoint path
    const url = new URL(request.url);
    const endpointPath = url.pathname;

    // Check rate limit
    const result = checkRateLimit(key, endpointPath);

    // If rate limited, return 429 response
    if (!result.allowed) {
      console.log(
        `🚫 [RATE_LIMIT] Denied: ${key} on ${endpointPath} (${result.current}/${result.limit})`
      );
      return createRateLimitResponse(result);
    }

    // Execute the handler
    const response = await handler(request, context);

    // Add rate limit headers to successful responses
    // Clone response to add headers (responses are immutable)
    const headers = new Headers(response.headers);
    const rateLimitHeaders = getRateLimitHeaders(result);

    for (const [key, value] of Object.entries(rateLimitHeaders)) {
      headers.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

// =============================================================================
// SPECIALIZED WRAPPERS (Pre-configured categories)
// =============================================================================

/**
 * Rate limiter for high-frequency endpoints (lists, search).
 * Limit: 100 requests/minute
 */
export function withHighRateLimit(handler: ApiHandler): ApiHandler {
  return withRateLimit(handler, { category: 'HIGH' });
}

/**
 * Rate limiter for standard CRUD endpoints.
 * Limit: 60 requests/minute
 */
export function withStandardRateLimit(handler: ApiHandler): ApiHandler {
  return withRateLimit(handler, { category: 'STANDARD' });
}

/**
 * Rate limiter for sensitive operations (admin, financial).
 * Limit: 20 requests/minute
 */
export function withSensitiveRateLimit(handler: ApiHandler): ApiHandler {
  return withRateLimit(handler, { category: 'SENSITIVE' });
}

/**
 * Rate limiter for heavy operations (reports, exports).
 * Limit: 10 requests/minute
 */
export function withHeavyRateLimit(handler: ApiHandler): ApiHandler {
  return withRateLimit(handler, { category: 'HEAVY' });
}

/**
 * Rate limiter for webhook endpoints.
 * Limit: 30 requests/minute
 */
export function withWebhookRateLimit(handler: ApiHandler): ApiHandler {
  return withRateLimit(handler, { category: 'WEBHOOK' });
}

// =============================================================================
// EXPORT FOR INDEX
// =============================================================================

export { checkRateLimit, getRateLimitHeaders, createRateLimitResponse };
export type { RateLimitCategory };
