/**
 * POST /api/procurement/rfqs/[rfqId]/lines/snapshot — Snapshot RFQ lines from BOQ
 *
 * Copy-on-create: BOQ items are snapshotted at RFQ creation time.
 * Subsequent BOQ changes do NOT propagate to the RFQ line (quote integrity).
 *
 * Auth: withAuth | Rate: sensitive
 * @see ADR-327 §17 step (d) Q29
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/define-route';
import { snapshotFromBoq } from '@/subapps/procurement/services/rfq-line-service';
import { TRADE_CODES } from '@/subapps/procurement/types/trade';
import { runProcurementMutation } from '../../../../_shared/procurement-mutation';
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

export const POST = defineRoute<z.ZodTypeAny, { rfqId: string }>({
  rateLimit: 'sensitive',
  handler: ({ req, auth, params }) =>
    runProcurementMutation({
      req,
      schema: SnapshotFromBoqSchema,
      logger,
      logMessage: 'RFQ snapshot error',
      logContext: { rfqId: params.rfqId },
      fallbackError: 'Failed to snapshot BOQ lines into RFQ',
      run: async (data) => {
        const lines = await snapshotFromBoq(auth, params.rfqId, data.boqItemIds, data.trade);
        return NextResponse.json(
          { success: true, data: lines, count: lines.length },
          { status: 201 },
        );
      },
    }),
});
