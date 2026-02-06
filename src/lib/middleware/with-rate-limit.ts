/**
 * 🔒 PR-1C: Rate Limited API Handler Wrapper (v2.0 - Secure Keying)
 *
 * Higher-order function that adds rate limiting to API handlers.
 * Production-grade for Vercel/serverless with Upstash Redis.
 *
 * @module lib/middleware/with-rate-limit
 * @version 2.0.0
 * @since 2026-01-29 - PR-1C Re-Architecture
 *
 * @enterprise Local_Protocol compliant:
 * - Secure keying: companyId+userId (no token substring!)
 * - Privacy-safe: hashed IP for anonymous requests
 * - No PII stored in rate limit keys
 */

import type { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import {
  checkRateLimit,
  createRateLimitResponse,
  getRateLimitHeaders,
  type RateLimitResult,
} from './rate-limiter';
import { type RateLimitCategory } from './rate-limit-config';
import { createModuleLogger } from '@/lib/telemetry';
import { getCurrentSecurityPolicy } from '@/config/environment-security-config';

// =============================================================================
// LOGGER (Centralized - NO console.*)
// =============================================================================

const logger = createModuleLogger('RATE_LIMIT_WRAPPER');

// =============================================================================
// TYPES
// =============================================================================

/**
 * API handler function type (matches Next.js App Router)
 * Supports both sync params (legacy) and async params (Next.js 15+)
 *
 * Note: context can be:
 * - undefined (no dynamic segments)
 * - { params?: Record<string, string> } (legacy sync params - optional)
 * - { params: Promise<Record<string, string>> } (Next.js 15+ async params - required)
 *
 * Using `any` for context to support all Next.js route patterns (forwarding only, not inspecting).
 * This is acceptable as we don't access the context in the rate limit middleware.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiHandler = (
  request: NextRequest,
  context?: any
) => Promise<Response> | Response;

/**
 * User identity from auth context (passed from withAuth middleware)
 */
interface UserIdentity {
  uid: string;
  companyId?: string;
}

/**
 * Rate limit options for the wrapper
 */
export interface WithRateLimitOptions {
  /** Override the auto-detected category */
  category?: RateLimitCategory;
  /**
   * Custom key extractor.
   * SECURITY: Must return a secure identifier (companyId:userId or hashed value).
   * DO NOT use token substrings!
   */
  getKey?: (request: NextRequest) => string | null;
  /** Skip rate limiting for certain conditions */
  skip?: (request: NextRequest) => boolean;
}

// =============================================================================
// SECURE KEY EXTRACTION
// =============================================================================

/**
 * Hash an IP address for privacy-safe storage.
 * Uses SHA-256 with a salt to prevent rainbow table attacks.
 */
function hashIpAddress(ip: string): string {
  const salt = process.env.RATE_LIMIT_IP_SALT || 'nestor-default-salt';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').substring(0, 16);
}

/**
 * Extract user identity from Firebase auth header.
 * This assumes the request has been processed by withAuth middleware.
 *
 * @returns User identity or null if not authenticated
 */
function extractUserIdentity(request: NextRequest): UserIdentity | null {
  // Check for user info set by withAuth middleware
  // These are typically set as custom headers after token verification
  const uid = request.headers.get('x-user-uid');
  const companyId = request.headers.get('x-user-company-id');

  if (uid) {
    return { uid, companyId: companyId || undefined };
  }

  return null;
}

/**
 * Extract secure identifier from request.
 *
 * Priority:
 * 1. Authenticated user: companyId:userId (most secure)
 * 2. Anonymous: hashed IP address (privacy-safe)
 *
 * SECURITY: This function NEVER uses token substrings.
 * Token-based identification is insecure because:
 * - Tokens change (rotation)
 * - Tokens are sensitive data
 * - First 32 chars are not unique across users
 *
 * @param request - Next.js request
 * @returns Secure identifier string
 */
function extractSecureIdentifier(request: NextRequest): string {
  // Try to get authenticated user identity
  const userIdentity = extractUserIdentity(request);

  if (userIdentity) {
    // Use companyId:userId format for tenant isolation
    const { uid, companyId } = userIdentity;
    if (companyId) {
      return `user:${companyId}:${uid}`;
    }
    // Fallback to uid only (should rarely happen in production)
    return `user:${uid}`;
  }

  // Anonymous request: use hashed IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';

  // Hash the IP for privacy
  const hashedIp = hashIpAddress(ip);
  return `anon:${hashedIp}`;
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
 * // Skip rate limiting for internal requests
 * export const GET = withRateLimit(myHandler, {
 *   skip: (req) => req.headers.get('x-internal-service') === process.env.INTERNAL_SECRET,
 * });
 * ```
 */
export function withRateLimit(
  handler: ApiHandler,
  options: WithRateLimitOptions = {}
): ApiHandler {
  return async (request: NextRequest, context) => {
    // 🔥 ENVIRONMENT-AWARE: Skip rate limiting if disabled in security policy
    const policy = getCurrentSecurityPolicy();
    if (!policy.enableRateLimiting) {
      logger.info('Rate limiting disabled for development environment');
      return handler(request, context);
    }

    // Check if we should skip rate limiting
    if (options.skip?.(request)) {
      return handler(request, context);
    }

    // Extract secure identifier
    const identifier = options.getKey?.(request) ?? extractSecureIdentifier(request);

    // If we couldn't extract an identifier, log and proceed
    // This is a safety fallback, should not happen in practice
    if (!identifier) {
      logger.warn('Could not extract identifier, skipping rate limit');
      return handler(request, context);
    }

    // Get endpoint path
    const url = new URL(request.url);
    const endpointPath = url.pathname;

    // Check rate limit (async for Upstash)
    let result: RateLimitResult;
    try {
      result = await checkRateLimit(identifier, endpointPath);
    } catch (error) {
      // Log error but don't block the request
      logger.error('Check failed, allowing request', { error: String(error) });
      return handler(request, context);
    }

    // If rate limited, return 429 response
    if (!result.allowed) {
      // PII-safe: hash identifier for logging (no raw userId/email)
      const identifierHash = createHash('sha256').update(identifier).digest('hex').substring(0, 8);
      logger.warn('Request denied', {
        identifierHash,
        endpoint: endpointPath,
        current: result.current,
        limit: result.limit,
      });
      return createRateLimitResponse(result);
    }

    // Execute the handler
    const response = await handler(request, context);

    // Add rate limit headers to successful responses
    const headers = new Headers(response.headers);
    const rateLimitHeaders = getRateLimitHeaders(result);

    for (const [headerKey, value] of Object.entries(rateLimitHeaders)) {
      headers.set(headerKey, value);
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

/**
 * Rate limiter for Telegram bot endpoints.
 * Limit: 15 requests/minute
 */
export function withTelegramRateLimit(handler: ApiHandler): ApiHandler {
  return withRateLimit(handler, { category: 'TELEGRAM' });
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

export { checkRateLimit, getRateLimitHeaders, createRateLimitResponse };
export type { RateLimitCategory, RateLimitResult };
