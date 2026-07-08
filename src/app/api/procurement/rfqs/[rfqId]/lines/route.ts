/**
 * GET  /api/procurement/rfqs/[rfqId]/lines — List RFQ lines
 * POST /api/procurement/rfqs/[rfqId]/lines — Add single RFQ line
 *
 * Auth: withAuth | Rate: standard (GET), sensitive (POST)
 * @see ADR-327 §17 step (d)
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import type { z } from 'zod';
import { NextResponse } from 'next/server';
import { defineRoute, ok, created } from '@/lib/api/define-route';
import { listRfqLines, addRfqLine } from '@/subapps/procurement/services/rfq-line-service';
import { RfqLineItemSchema } from '../../../_shared/rfq-line-schema';
import { runProcurementMutation } from '../../../_shared/procurement-mutation';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('RFQ_LINES_API');

// ============================================================================
// GET — List lines ordered by displayOrder
// ============================================================================

export const GET = defineRoute<z.ZodTypeAny, { rfqId: string }>({
  rateLimit: 'standard',
  fallbackError: 'Failed to list RFQ lines',
  handler: async ({ auth, params }) => ok(await listRfqLines(auth, params.rfqId)),
});

// ============================================================================
// POST — Add single line (null-guard → 500)
// ============================================================================

export const POST = defineRoute<z.ZodTypeAny, { rfqId: string }>({
  rateLimit: 'sensitive',
  handler: ({ req, auth, params }) =>
    runProcurementMutation({
      req,
      schema: RfqLineItemSchema,
      logger,
      logMessage: 'RFQ line create error',
      logContext: { rfqId: params.rfqId },
      fallbackError: 'Failed to add RFQ line',
      run: async (data) => {
        const line = await addRfqLine(auth, params.rfqId, data);
        if (!line) {
          return NextResponse.json(
            { success: false, error: 'Failed to create line' },
            { status: 500 },
          );
        }
        return created(line);
      },
    }),
});
