/**
 * POST   /api/procurement/sourcing-events/[eventId]/rfqs — Link RFQ to event
 * DELETE /api/procurement/sourcing-events/[eventId]/rfqs — Unlink RFQ from event
 *
 * Both operations are atomic (Firestore transaction) and idempotent.
 * Body: { rfqId: string }
 *
 * Auth: withAuth | Rate: sensitive
 * @see ADR-327 §17 step (d) Q31
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  addRfqToSourcingEvent,
  removeRfqFromSourcingEvent,
} from '@/subapps/procurement/services/sourcing-event-service';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
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

async function handlePost(
  request: NextRequest,
  segmentData?: { params: Promise<{ eventId: string }> },
): Promise<NextResponse> {
  const { eventId } = await segmentData!.params;
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const parsed = safeParseBody(RfqLinkSchema, await req.json());
        if (parsed.error) return parsed.error;
        await addRfqToSourcingEvent(ctx, eventId, parsed.data.rfqId);
        return NextResponse.json({ success: true, message: 'RFQ linked to sourcing event' });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to link RFQ to sourcing event');
        logger.error('Sourcing event link RFQ error', { eventId, error: message });
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
// DELETE — Unlink RFQ (atomic, idempotent — no-op if not linked)
// ============================================================================

async function handleDelete(
  request: NextRequest,
  segmentData?: { params: Promise<{ eventId: string }> },
): Promise<NextResponse> {
  const { eventId } = await segmentData!.params;
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const parsed = safeParseBody(RfqLinkSchema, await req.json());
        if (parsed.error) return parsed.error;
        await removeRfqFromSourcingEvent(ctx, eventId, parsed.data.rfqId);
        return NextResponse.json({ success: true, message: 'RFQ unlinked from sourcing event' });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to unlink RFQ from sourcing event');
        logger.error('Sourcing event unlink RFQ error', { eventId, error: message });
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
export const DELETE = withSensitiveRateLimit(handleDelete);
