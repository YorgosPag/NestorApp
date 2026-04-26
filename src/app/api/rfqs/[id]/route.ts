/**
 * GET    /api/rfqs/[id] — Get single RFQ
 * PATCH  /api/rfqs/[id] — Update RFQ / FSM transitions
 * DELETE /api/rfqs/[id] — Soft delete (archive)
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
import { getRfq, updateRfq, archiveRfq } from '@/subapps/procurement/services/rfq-service';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { TRADE_CODES } from '@/subapps/procurement/types/trade';

// ============================================================================
// SCHEMAS
// ============================================================================

const RfqLineSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1).max(500),
  trade: z.enum(TRADE_CODES),
  categoryCode: z.string().max(30).nullable().default(null),
  quantity: z.number().positive().nullable().default(null),
  unit: z.string().max(20).nullable().default(null),
  notes: z.string().max(500).nullable().default(null),
});

const UpdateRfqSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  lines: z.array(RfqLineSchema).max(100).optional(),
  deadlineDate: z.string().nullable().optional(),
  status: z.enum(['draft', 'active', 'closed', 'archived']).optional(),
  awardMode: z.enum(['whole_package', 'cherry_pick']).optional(),
  reminderTemplate: z.enum(['aggressive', 'standard', 'soft', 'off']).optional(),
  winnerQuoteId: z.string().nullable().optional(),
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
      const rfq = await getRfq(ctx.companyId, id);
      if (!rfq) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
      return NextResponse.json({ success: true, data: rfq });
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
        const parsed = safeParseBody(UpdateRfqSchema, await req.json());
        if (parsed.error) return parsed.error;
        const updated = await updateRfq(ctx, id, parsed.data);
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
        await archiveRfq(ctx, id);
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
