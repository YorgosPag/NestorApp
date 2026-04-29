/**
 * PATCH  /api/procurement/rfqs/[rfqId]/lines/[lineId] — Update RFQ line
 * DELETE /api/procurement/rfqs/[rfqId]/lines/[lineId] — Delete RFQ line
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
import { updateRfqLine, deleteRfqLine } from '@/subapps/procurement/services/rfq-line-service';
import { TRADE_CODES } from '@/subapps/procurement/types/trade';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('RFQ_LINE_API');

// ============================================================================
// SCHEMAS
// ============================================================================

const UpdateRfqLineSchema = z.object({
  description: z.string().min(1).max(1000).optional(),
  trade: z.enum(TRADE_CODES).optional(),
  categoryCode: z.string().nullable().optional(),
  quantity: z.number().nullable().optional(),
  unit: z.string().max(20).nullable().optional(),
  unitPrice: z.number().min(0).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

// ============================================================================
// PATCH — Update line fields
// ============================================================================

async function handlePatch(
  request: NextRequest,
  segmentData?: { params: Promise<{ rfqId: string; lineId: string }> },
): Promise<NextResponse> {
  const { rfqId, lineId } = await segmentData!.params;
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const parsed = safeParseBody(UpdateRfqLineSchema, await req.json());
        if (parsed.error) return parsed.error;
        const line = await updateRfqLine(ctx, rfqId, lineId, parsed.data);
        return NextResponse.json({ success: true, data: line });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to update RFQ line');
        logger.error('RFQ line update error', { rfqId, lineId, error: message });
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
// DELETE — Remove line
// ============================================================================

async function handleDelete(
  request: NextRequest,
  segmentData?: { params: Promise<{ rfqId: string; lineId: string }> },
): Promise<NextResponse> {
  const { rfqId, lineId } = await segmentData!.params;
  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        await deleteRfqLine(ctx, rfqId, lineId);
        return NextResponse.json({ success: true, message: 'RFQ line deleted' });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to delete RFQ line');
        logger.error('RFQ line delete error', { rfqId, lineId, error: message });
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

export const PATCH = withSensitiveRateLimit(handlePatch);
export const DELETE = withSensitiveRateLimit(handleDelete);
