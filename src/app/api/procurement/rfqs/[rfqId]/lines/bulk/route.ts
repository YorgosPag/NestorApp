/**
 * POST /api/procurement/rfqs/[rfqId]/lines/bulk — Bulk create RFQ lines
 *
 * Auth: withAuth | Rate: sensitive
 * @see ADR-327 §17 step (d)
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/define-route';
import { addRfqLinesBulk } from '@/subapps/procurement/services/rfq-line-service';
import { RfqLineItemSchema } from '../../../../_shared/rfq-line-schema';
import { runProcurementMutation } from '../../../../_shared/procurement-mutation';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('RFQ_LINES_BULK_API');

// ============================================================================
// SCHEMAS
// ============================================================================

const BulkCreateSchema = z.object({
  lines: z.array(RfqLineItemSchema).min(1).max(500),
});

// ============================================================================
// POST — Bulk insert up to 500 lines (Firestore batch)
// ============================================================================

export const POST = defineRoute<z.ZodTypeAny, { rfqId: string }>({
  rateLimit: 'sensitive',
  handler: ({ req, auth, params }) =>
    runProcurementMutation({
      req,
      schema: BulkCreateSchema,
      logger,
      logMessage: 'RFQ lines bulk error',
      logContext: { rfqId: params.rfqId },
      fallbackError: 'Failed to bulk create RFQ lines',
      run: async (data) => {
        const lines = await addRfqLinesBulk(auth, params.rfqId, data.lines);
        return NextResponse.json(
          { success: true, data: lines, count: lines.length },
          { status: 201 },
        );
      },
    }),
});
