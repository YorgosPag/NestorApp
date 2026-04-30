/**
 * GET    /api/quotes/[id] — Get single quote
 * PATCH  /api/quotes/[id] — Update quote / FSM transitions
 * DELETE /api/quotes/[id] — Soft delete (archive)
 *
 * Auth: withAuth | Rate: standard (GET), sensitive (PATCH/DELETE)
 * @see ADR-327 §5.3 Phase P1b
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import {
  withStandardRateLimit,
  withSensitiveRateLimit,
} from '@/lib/middleware/with-rate-limit';
import { getQuote, updateQuote, archiveQuote } from '@/subapps/procurement/services/quote-service';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { QUOTE_STATUSES } from '@/subapps/procurement/types/quote';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('QuoteRoute');

// ============================================================================
// SCHEMAS
// ============================================================================

const QuoteLineSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1).max(500),
  categoryCode: z.string().max(30).nullable().default(null),
  // quantity may be 0 — AI extraction of multi-row tables can yield parent
  // rows / sub-totals / descriptive rows where quantity is intentionally
  // empty. The user removes them in review if needed (X button).
  quantity: z.number().min(0),
  unit: z.string().min(1).max(20),
  unitPrice: z.number().min(0),
  vatRate: z.union([z.literal(0), z.literal(6), z.literal(13), z.literal(24)]),
  lineTotal: z.number().min(0),
  notes: z.string().max(500).nullable().default(null),
});

const UpdateQuoteSchema = z.object({
  status: z.enum(QUOTE_STATUSES).optional(),
  lines: z.array(QuoteLineSchema).max(200).optional(),
  quotedTotal: z.number().min(0).nullable().optional(),
  totalNet: z.number().min(0).optional(),
  totalVat: z.number().min(0).optional(),
  totalGross: z.number().min(0).optional(),
  validUntil: z.string().nullable().optional(),
  paymentTerms: z.string().max(500).nullable().optional(),
  deliveryTerms: z.string().max(500).nullable().optional(),
  warranty: z.string().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  overrideReason: z.string().min(20).max(1000).optional(),
  vendorContactId: z.string().min(1).optional(),
  vatIncluded: z.boolean().nullable().optional(),
  laborIncluded: z.boolean().nullable().optional(),
});

// ============================================================================
// GET
// ============================================================================

async function handleGet(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await segmentData!.params;
  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const quote = await getQuote(ctx.companyId, id);
        if (!quote) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
        return NextResponse.json({ success: true, data: quote });
      } catch (error) {
        logger.error('GET /api/quotes/[id] — Firestore failure', {
          quoteId: id,
          companyId: ctx.companyId,
          error: getErrorMessage(error),
        });
        return NextResponse.json(
          { success: false, error: 'Service unavailable' },
          { status: 503 },
        );
      }
    }
  );
  return handler(request);
}

// ============================================================================
// PATCH
// ============================================================================

async function handlePatch(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await segmentData!.params;
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const parsed = safeParseBody(UpdateQuoteSchema, await req.json());
        if (parsed.error) return parsed.error;
        const updated = await updateQuote(ctx, id, parsed.data);
        return NextResponse.json({ success: true, data: updated });
      } catch (error) {
        return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 400 });
      }
    }
  );
  return handler(request);
}

// ============================================================================
// DELETE — soft delete
// ============================================================================

async function handleDelete(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await segmentData!.params;
  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        await archiveQuote(ctx, id);
        return NextResponse.json({ success: true });
      } catch (error) {
        return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 400 });
      }
    }
  );
  return handler(request);
}

// ============================================================================
// EXPORTS
// ============================================================================

export const GET = withStandardRateLimit(handleGet);
export const PATCH = withSensitiveRateLimit(handlePatch);
export const DELETE = withSensitiveRateLimit(handleDelete);
