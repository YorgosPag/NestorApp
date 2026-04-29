/**
 * POST /api/procurement/rfqs/[rfqId]/lines/snapshot — Snapshot RFQ lines from BOQ
 *
 * Copy-on-create: BOQ items are snapshotted at RFQ creation time.
 * Subsequent BOQ changes do NOT propagate to the RFQ line (quote integrity).
 *
 * Auth: withAuth | Rate: sensitive
 * @see ADR-327 §17 step (d) Q29
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { snapshotFromBoq } from '@/subapps/procurement/services/rfq-line-service';
import { TRADE_CODES } from '@/subapps/procurement/types/trade';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('RFQ_LINES_SNAPSHOT_API');

// ============================================================================
// SCHEMAS
// ============================================================================

const SnapshotFromBoqSchema = z.object({
  boqItemIds: z.array(z.string().min(1)).min(1).max(30),
  trade: z.enum(TRADE_CODES),
});

// ============================================================================
// POST — Snapshot BOQ items into RFQ lines
// ============================================================================

async function handlePost(
  request: NextRequest,
  segmentData?: { params: Promise<{ rfqId: string }> },
): Promise<NextResponse> {
  const { rfqId } = await segmentData!.params;
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const parsed = safeParseBody(SnapshotFromBoqSchema, await req.json());
        if (parsed.error) return parsed.error;
        const lines = await snapshotFromBoq(ctx, rfqId, parsed.data.boqItemIds, parsed.data.trade);
        return NextResponse.json(
          { success: true, data: lines, count: lines.length },
          { status: 201 },
        );
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to snapshot BOQ lines into RFQ');
        logger.error('RFQ snapshot error', { rfqId, error: message });
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
