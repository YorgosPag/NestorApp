/**
 * PATCH  /api/procurement/rfqs/[rfqId]/lines/[lineId] — Update RFQ line
 * DELETE /api/procurement/rfqs/[rfqId]/lines/[lineId] — Delete RFQ line
 *
 * Auth: withAuth | Rate: sensitive
 * @see ADR-327 §17 step (d)
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import type { z } from 'zod';
import { NextResponse } from 'next/server';
import { defineRoute, ok } from '@/lib/api/define-route';
import { updateRfqLine, deleteRfqLine } from '@/subapps/procurement/services/rfq-line-service';
import { UpdateRfqLineSchema } from '../../../../_shared/rfq-line-schema';
import { runProcurementMutation } from '../../../../_shared/procurement-mutation';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('RFQ_LINE_API');

// ============================================================================
// PATCH — Update line fields
// ============================================================================

export const PATCH = defineRoute<z.ZodTypeAny, { rfqId: string; lineId: string }>({
  rateLimit: 'sensitive',
  handler: ({ req, auth, params }) =>
    runProcurementMutation({
      req,
      schema: UpdateRfqLineSchema,
      logger,
      logMessage: 'RFQ line update error',
      logContext: { rfqId: params.rfqId, lineId: params.lineId },
      fallbackError: 'Failed to update RFQ line',
      run: async (data) => ok(await updateRfqLine(auth, params.rfqId, params.lineId, data)),
    }),
});

// ============================================================================
// DELETE — Remove line
// ============================================================================

export const DELETE = defineRoute<z.ZodTypeAny, { rfqId: string; lineId: string }>({
  rateLimit: 'sensitive',
  handler: ({ auth, params, req }) =>
    runProcurementMutation({
      req,
      logger,
      logMessage: 'RFQ line delete error',
      logContext: { rfqId: params.rfqId, lineId: params.lineId },
      fallbackError: 'Failed to delete RFQ line',
      run: async () => {
        await deleteRfqLine(auth, params.rfqId, params.lineId);
        return NextResponse.json({ success: true, message: 'RFQ line deleted' });
      },
    }),
});
