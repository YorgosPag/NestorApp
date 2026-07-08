/**
 * POST   /api/procurement/sourcing-events/[eventId]/rfqs — Link RFQ to event
 * DELETE /api/procurement/sourcing-events/[eventId]/rfqs — Unlink RFQ from event
 *
 * Both operations are atomic (Firestore transaction) and idempotent.
 * Body: { rfqId: string }
 *
 * Auth: withAuth | Rate: sensitive
 * @see ADR-327 §17 step (d) Q31
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/define-route';
import {
  addRfqToSourcingEvent,
  removeRfqFromSourcingEvent,
} from '@/subapps/procurement/services/sourcing-event-service';
import { runProcurementMutation } from '../../../_shared/procurement-mutation';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('SOURCING_EVENT_RFQS_API');

// ============================================================================
// SCHEMAS
// ============================================================================

const RfqLinkSchema = z.object({
  rfqId: z.string().min(1),
});

// ============================================================================
// POST — Link RFQ (atomic, idempotent — no-op if already linked)
// ============================================================================

export const POST = defineRoute<z.ZodTypeAny, { eventId: string }>({
  rateLimit: 'sensitive',
  handler: ({ req, auth, params }) =>
    runProcurementMutation({
      req,
      schema: RfqLinkSchema,
      logger,
      logMessage: 'Sourcing event link RFQ error',
      logContext: { eventId: params.eventId },
      fallbackError: 'Failed to link RFQ to sourcing event',
      run: async (data) => {
        await addRfqToSourcingEvent(auth, params.eventId, data.rfqId);
        return NextResponse.json({ success: true, message: 'RFQ linked to sourcing event' });
      },
    }),
});

// ============================================================================
// DELETE — Unlink RFQ (atomic, idempotent — no-op if not linked)
// ============================================================================

export const DELETE = defineRoute<z.ZodTypeAny, { eventId: string }>({
  rateLimit: 'sensitive',
  handler: ({ req, auth, params }) =>
    runProcurementMutation({
      req,
      schema: RfqLinkSchema,
      logger,
      logMessage: 'Sourcing event unlink RFQ error',
      logContext: { eventId: params.eventId },
      fallbackError: 'Failed to unlink RFQ from sourcing event',
      run: async (data) => {
        await removeRfqFromSourcingEvent(auth, params.eventId, data.rfqId);
        return NextResponse.json({ success: true, message: 'RFQ unlinked from sourcing event' });
      },
    }),
});
