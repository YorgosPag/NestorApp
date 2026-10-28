/**
 * ROUTE SHELL — ΕΝΑ σημείο για «id από το segment + withAuth» στα routes `/api/quotes/[id]/**`
 * (ήταν τρία αντίγραφα στο `[id]/route.ts`, CHECK 3.28· μετακόμισε εδώ για το `leveling-plugs`, ADR-327 §8.5).
 *
 * @module app/api/quotes/_shared/quote-id-route
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { getErrorMessage } from '@/lib/error-utils';

export type QuoteIdHandler = (req: NextRequest, ctx: AuthContext, id: string) => Promise<NextResponse>;

export function quoteIdRoute(run: QuoteIdHandler) {
  return async (request: NextRequest, segmentData?: { params: Promise<{ id: string }> }): Promise<NextResponse> => {
    const { id } = await segmentData!.params;
    const handler = withAuth(
      async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => run(req, ctx, id),
    );
    return handler(request);
  };
}

export function quoteBadRequest(error: unknown): NextResponse {
  return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 400 });
}
