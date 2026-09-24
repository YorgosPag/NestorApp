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
  createRateLimitUnavailableResponse,
  getRateLimitHeaders,
  type RateLimitResult,
} from './rate-limiter';
// ⚠️ Απευθείας από την πηγή, **όχι** από το barrel (`./index`): μια εξαγωγή στο barrel
//    χωρίς καταναλωτή *εκτός* του πακέτου είναι νεκρή εξαγωγή (CHECK 3.30).
import {
  getCategoryFailMode,
  getEndpointCategory,
  type RateLimitCategory,
} from './rate-limit-config';
import { clientIpFingerprint, clientIpOf } from '@/lib/http/client-ip';
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
 * Using a permissive context union to support all Next.js route patterns (forwarding only, not inspecting).
 * This is acceptable as we don't access the context in the rate limit middleware.
 */
// 🏢 ENTERPRISE: Generic handler type — preserves route-specific context types.
// The middleware forwards context transparently without inspection.
// Context is optional to support both parametric routes (with params) and
// parameter-less routes. Handlers that need context should use non-null assertion
// or guard, since Next.js always provides params for dynamic routes.
type ApiHandler<C = unknown> = (
  request: NextRequest,
  context?: C
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
  const ip = clientIpOf(request.headers);

  // Hash the IP for privacy
  const hashedIp = clientIpFingerprint(ip);
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
export function withRateLimit<C = unknown>(
  handler: ApiHandler<C>,
  options: WithRateLimitOptions = {}
): ApiHandler<C> {
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
      // 🔴 ADR-855 Α1 — **Η ΔΗΛΩΣΗ ΤΗΣ ΔΙΑΔΡΟΜΗΣ ΦΤΑΝΕΙ ΕΠΙΤΕΛΟΥΣ ΣΤΗ ΜΗΧΑΝΗ.**
      //    Μέχρι σήμερα αυτή η γραμμή έγραφε `checkRateLimit(identifier, endpointPath)` και
      //    το `options.category` — δηλωμένο στον τύπο (γρ. 74), τεκμηριωμένο από το PR-1C ως
      //    «Override Auto-Detection», περασμένο από **και τους επτά** wrappers — **δεν
      //    διαβαζόταν πουθενά**. Το διπλανό `options.getKey` (γρ. 197) δούλευε κανονικά:
      //    ίδιο αντικείμενο επιλογών, το ένα πεδίο τιμώμενο και το άλλο αγνοημένο σιωπηλά.
      //    ⚠️ Μετρημένο: **89 στις 449** διαδρομές έτρεχαν άλλο όριο από όσο δήλωναν.
      result = await checkRateLimit(identifier, endpointPath, options.category);
    } catch (error) {
      // 🔴 ADR-855 Α3 — **ΤΟ ΜΟΝΟΠΑΤΙ ΠΟΥ ΔΕΝ ΕΧΕΙ ΚΑΝ ΑΠΟΤΕΛΕΣΜΑ.** Ο store μπορεί να
      //    ρίξει *πριν* παραχθεί `result` (ψυχρή εκκίνηση, λάθος ρύθμιση Upstash). Μέχρι
      //    σήμερα η γραμμή ήταν «log και άσε το να περάσει», **καθολικά** — και ήταν το
      //    δεύτερο, ανεξάρτητο fail-open δίπλα σε αυτό του store.
      //
      // ⚠️ Η βαθμίδα υπολογίζεται **εδώ** από τη δήλωση ή τον πίνακα: δεν υπάρχει `result`
      //    για να τη ρωτήσουμε, και μια προεπιλογή «open» θα ξανάνοιγε την ίδια τρύπα.
      const category = options.category ?? getEndpointCategory(endpointPath);
      const failMode = getCategoryFailMode(category);
      logger.error('Check failed', { error: String(error), category, failMode });

      if (failMode === 'closed') {
        return createRateLimitUnavailableResponse({
          allowed: false, current: 0, limit: 0, resetMs: 0, degraded: true, category,
        });
      }
      return handler(request, context);
    }

    // 🔴 ADR-855 Α3 — **Ο ΜΕΤΡΗΤΗΣ ΑΠΑΝΤΗΣΕ «ΝΑΙ» ΧΩΡΙΣ ΝΑ ΜΕΤΡΗΣΕΙ.**
    //
    // Το `degraded` σημαίνει ότι το `allowed: true` είναι η ασφαλής προεπιλογή του store,
    // όχι πραγματικό πλήθος. Για βαθμίδα `closed` αυτό **δεν** είναι αποδεκτό: εκεί ζουν οι
    // δημόσιες πόρτες χωρίς ταυτότητα και η επιφάνεια διαπιστευτηρίων, όπου απεριόριστες
    // προσπάθειες είναι παράκαμψη εξουσιοδότησης — *«allowing a request you couldn't
    // authorize is a security bypass»*.
    //
    // ⚠️ Για βαθμίδα `open` **τίποτα δεν αλλάζει**: μια αστοχία του limiter δεν επιτρέπεται
    //    να γίνει αστοχία του API. Η διάκριση είναι ο λόγος που η βαθμίδα κουβαλά `failMode`.
    if (result.degraded && getCategoryFailMode(result.category) === 'closed') {
      logger.error('Rate limiter unavailable — failing closed', {
        endpoint: endpointPath,
        category: result.category,
      });
      return createRateLimitUnavailableResponse(result);
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
export function withHighRateLimit<C = unknown>(handler: ApiHandler<C>): ApiHandler<C> {
  return withRateLimit(handler, { category: 'HIGH' });
}

/**
 * Rate limiter for immutable binary asset proxies (ADR-655).
 * Limit: 600 requests/minute
 */
export function withAssetRateLimit<C = unknown>(handler: ApiHandler<C>): ApiHandler<C> {
  return withRateLimit(handler, { category: 'ASSET' });
}

/**
 * Rate limiter for standard CRUD endpoints.
 * Limit: 60 requests/minute
 */
export function withStandardRateLimit<C = unknown>(handler: ApiHandler<C>): ApiHandler<C> {
  return withRateLimit(handler, { category: 'STANDARD' });
}

/**
 * Rate limiter for sensitive operations (admin, financial).
 * Limit: 20 requests/minute
 */
export function withSensitiveRateLimit<C = unknown>(handler: ApiHandler<C>): ApiHandler<C> {
  return withRateLimit(handler, { category: 'SENSITIVE' });
}

/**
 * Rate limiter for heavy operations (reports, exports).
 * Limit: 10 requests/minute
 */
export function withHeavyRateLimit<C = unknown>(handler: ApiHandler<C>): ApiHandler<C> {
  return withRateLimit(handler, { category: 'HEAVY' });
}

/**
 * Rate limiter for webhook endpoints.
 * Limit: 30 requests/minute
 */
export function withWebhookRateLimit<C = unknown>(handler: ApiHandler<C>): ApiHandler<C> {
  return withRateLimit(handler, { category: 'WEBHOOK' });
}

/**
 * Rate limiter for Telegram bot endpoints.
 * Limit: 15 requests/minute
 */
export function withTelegramRateLimit<C = unknown>(handler: ApiHandler<C>): ApiHandler<C> {
  return withRateLimit(handler, { category: 'TELEGRAM' });
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

export { checkRateLimit, getRateLimitHeaders, createRateLimitResponse };
export type { RateLimitCategory, RateLimitResult };
