/**
 * =============================================================================
 * SHOWCASE CORE — The `[token]` route export, once
 * =============================================================================
 *
 * The last thing every public showcase route still repeated: await the dynamic
 * segment, hand the token to the handler, optionally wrap in a rate limiter.
 * Six copies of eight lines.
 *
 * ## The rate-limit argument is mandatory on purpose
 *
 * Centralising this surfaced a real inconsistency: the two **PDF** routes wrap
 * in `withStandardRateLimit`, while the four **payload** routes — equally
 * anonymous, and the ones that run a Firestore snapshot build plus two media
 * queries per hit — wrap in nothing at all. `create-public-payload-route.ts`
 * even documents the opposite ("rate limiting sits on the
 * `withStandardRateLimit` wrapper at the route file").
 *
 * That gap is **preserved, not quietly closed** — adding a limiter to a live
 * public endpoint is a behaviour change and belongs to a decision, not to a
 * de-duplication commit (ADR-698 §8.2). Making the parameter required means
 * every route file now *states* which side it is on, so the gap is visible in
 * review instead of implied by an absent wrapper.
 *
 * @module services/showcase-core/api/create-token-route-export
 * @enterprise ADR-698 — Public Showcase Token Surface SSoT
 */

import type { NextRequest, NextResponse } from 'next/server';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

/** Next.js dynamic-segment context for a `[token]` route. */
export type TokenSegmentData = { params: Promise<{ token: string }> };

/** Anything the showcase factories return: a handler keyed by raw token. */
export interface PublicTokenHandler {
  handle(request: NextRequest, token: string): Promise<NextResponse>;
}

/**
 * Rate-limit posture of a public token route.
 *
 * `'none'` is spelled out rather than defaulted — an unlimited anonymous
 * endpoint should be an explicit statement in the file that publishes it.
 */
export type PublicTokenRateLimit = 'standard' | 'none';

/**
 * Build the `GET` export for a `[token]` route.
 *
 * @example
 * export const GET = createPublicTokenRouteExport(route, 'standard');
 */
export function createPublicTokenRouteExport(
  handler: PublicTokenHandler,
  rateLimit: PublicTokenRateLimit,
): (request: NextRequest, segmentData: TokenSegmentData) => Promise<Response> {
  return async (request: NextRequest, segmentData: TokenSegmentData): Promise<Response> => {
    const { token } = await segmentData.params;

    if (rateLimit === 'none') {
      return handler.handle(request, token);
    }

    const limited = withStandardRateLimit<TokenSegmentData>(
      async (req: NextRequest) => handler.handle(req, token),
    );

    return limited(request);
  };
}
