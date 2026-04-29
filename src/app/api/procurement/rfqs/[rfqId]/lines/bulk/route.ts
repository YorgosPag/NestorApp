/**
 * POST /api/procurement/rfqs/[rfqId]/lines/bulk — Bulk create RFQ lines
 *
 * Auth: withAuth | Rate: sensitive
 * @see ADR-327 §17 step (d)
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { addRfqLinesBulk } from '@/subapps/procurement/services/rfq-line-service';
import { TRADE_CODES } from '@/subapps/procurement/types/trade';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('RFQ_LINES_BULK_API');

// ============================================================================
// SCHEMAS
// ============================================================================

const RfqLineItemSchema = z.object({
  source: z.enum(['boq', 'ad_hoc']),
  boqItemId: z.string().nullable().optional(),
  description: z.string().min(1).max(1000),
  trade: z.enum(TRADE_CODES),
  categoryCode: z.string().nullable().optional(),
  quantity: z.number().nullable().optional(),
  unit: z.string().max(20).nullable().optional(),
  unitPrice: z.number().min(0).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

const BulkCreateSchema = z.object({
  lines: z.array(RfqLineItemSchema).min(1).max(500),
});

// ============================================================================
// POST — Bulk insert up to 500 lines (Firestore batch)
// ============================================================================

async function handlePost(
  request: NextRequest,
  segmentData?: { params: Promise<{ rfqId: string }> },
): Promise<NextResponse> {
  const { rfqId } = await segmentData!.params;
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const parsed = safeParseBody(BulkCreateSchema, await req.json());
        if (parsed.error) return parsed.error;
        const lines = await addRfqLinesBulk(ctx, rfqId, parsed.data.lines);
        return NextResponse.json(
          { success: true, data: lines, count: lines.length },
          { status: 201 },
        );
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to bulk create RFQ lines');
        logger.error('RFQ lines bulk error', { rfqId, error: message });
        return NextResponse.json(
          { success: false, error: message },
          { status: errorStatus(error) },
        );
      }
    },
  );
  return handler(request);
}

// ============================================================================
// HELPERS
// ============================================================================

function errorStatus(error: unknown): number {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes('not found')) return 404;
  if (msg.includes('Forbidden')) return 403;
  return 400;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const POST = withSensitiveRateLimit(handlePost);
