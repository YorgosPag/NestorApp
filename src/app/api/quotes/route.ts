/**
 * GET  /api/quotes — List quotes (scoped by companyId)
 * POST /api/quotes — Create quote
 *
 * Auth: withAuth | Rate: standard (GET), sensitive (POST)
 * @see ADR-327 §5.3 Phase 1a
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
import { createQuote, listQuotes } from '@/subapps/procurement/services/quote-service';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { TRADE_CODES } from '@/subapps/procurement/types/trade';
import { QUOTE_STATUSES } from '@/subapps/procurement/types/quote';
import type { QuoteStatus } from '@/subapps/procurement/types/quote';

const logger = createModuleLogger('QUOTES_API');

// ============================================================================
// SCHEMAS
// ============================================================================

const QuoteLineSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1).max(500),
  categoryCode: z.string().max(30).nullable().default(null),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(20),
  unitPrice: z.number().min(0),
  vatRate: z.union([z.literal(0), z.literal(6), z.literal(13), z.literal(24)]),
  lineTotal: z.number().min(0),
  notes: z.string().max(500).nullable().default(null),
});

const CreateQuoteSchema = z.object({
  rfqId: z.string().nullable().optional(),
  projectId: z.string().min(1),
  buildingId: z.string().nullable().optional(),
  vendorContactId: z.string().min(1),
  trade: z.enum(TRADE_CODES),
  source: z.enum(['manual', 'scan', 'portal', 'email_inbox']).default('manual'),
  lines: z.array(QuoteLineSchema).max(200).optional(),
  validUntil: z.string().nullable().optional(),
  paymentTerms: z.string().max(500).nullable().optional(),
  deliveryTerms: z.string().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

// ============================================================================
// GET — List Quotes
// ============================================================================

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const url = new URL(req.url);
        const projectId = url.searchParams.get('projectId') ?? undefined;
        const rfqId = url.searchParams.get('rfqId') ?? undefined;
        const trade = url.searchParams.get('trade') ?? undefined;
        const vendorContactId = url.searchParams.get('vendorContactId') ?? undefined;
        const statusParam = url.searchParams.get('status') ?? undefined;
        const status = statusParam && (QUOTE_STATUSES as readonly string[]).includes(statusParam)
          ? statusParam as QuoteStatus
          : undefined;

        const quotes = await listQuotes(ctx.companyId, {
          projectId,
          rfqId,
          trade: trade as never,
          vendorContactId,
          status,
        });
        return NextResponse.json({ success: true, data: quotes });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to list quotes');
        logger.error('Quote list error', { error: message });
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );
  return handler(request);
}

// ============================================================================
// POST — Create Quote
// ============================================================================

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const parsed = safeParseBody(CreateQuoteSchema, await req.json());
        if (parsed.error) return parsed.error;

        const result = await createQuote(ctx, {
          ...parsed.data,
          rfqId: parsed.data.rfqId ?? null,
          buildingId: parsed.data.buildingId ?? null,
        });

        return NextResponse.json({ success: true, data: result }, { status: 201 });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to create quote');
        logger.error('Quote create error', { error: message });
        return NextResponse.json({ success: false, error: message }, { status: 400 });
      }
    }
  );
  return handler(request);
}

// ============================================================================
// EXPORTS
// ============================================================================

export const GET = withStandardRateLimit(handleGet);

export const POST = withSensitiveRateLimit(handlePost);
