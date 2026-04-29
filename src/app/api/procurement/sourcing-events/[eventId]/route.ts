/**
 * GET   /api/procurement/sourcing-events/[eventId] — Get single sourcing event
 * PATCH /api/procurement/sourcing-events/[eventId] — Update sourcing event
 *
 * Auth: withAuth | Rate: standard (GET), sensitive (PATCH)
 * @see ADR-327 §17 step (d) Q31
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit, withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  getSourcingEvent,
  updateSourcingEvent,
} from '@/subapps/procurement/services/sourcing-event-service';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('SOURCING_EVENT_API');

// ============================================================================
// SCHEMAS
// ============================================================================

const UpdateSourcingEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(['draft', 'active', 'partial', 'closed', 'archived']).optional(),
  deadlineDate: z.string().nullable().optional(),
});

// ============================================================================
// GET — Single event (404 if not found or wrong tenant)
// ============================================================================

async function handleGet(
  request: NextRequest,
  segmentData?: { params: Promise<{ eventId: string }> },
): Promise<NextResponse> {
  const { eventId } = await segmentData!.params;
  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const event = await getSourcingEvent(ctx, eventId);
        if (!event) {
          return NextResponse.json(
            { success: false, error: 'Sourcing event not found' },
            { status: 404 },
          );
        }
        return NextResponse.json({ success: true, data: event });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to get sourcing event');
        logger.error('Sourcing event get error', { eventId, error: message });
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    },
  );
  return handler(request);
}

// ============================================================================
// PATCH — Update fields or trigger status transition
// ============================================================================

async function handlePatch(
  request: NextRequest,
  segmentData?: { params: Promise<{ eventId: string }> },
): Promise<NextResponse> {
  const { eventId } = await segmentData!.params;
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const parsed = safeParseBody(UpdateSourcingEventSchema, await req.json());
        if (parsed.error) return parsed.error;
        const event = await updateSourcingEvent(ctx, eventId, parsed.data);
        return NextResponse.json({ success: true, data: event });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to update sourcing event');
        logger.error('Sourcing event update error', { eventId, error: message });
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

export const GET = withStandardRateLimit(handleGet);
export const PATCH = withSensitiveRateLimit(handlePatch);
