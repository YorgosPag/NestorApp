/**
 * GET  /api/procurement/sourcing-events — List sourcing events
 * POST /api/procurement/sourcing-events — Create sourcing event
 *
 * Query params (GET): status, projectId, search
 *
 * Auth: withAuth | Rate: standard (GET), sensitive (POST)
 * @see ADR-327 §17 step (d) Q31
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit, withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  listSourcingEvents,
  createSourcingEvent,
} from '@/subapps/procurement/services/sourcing-event-service';
import type { SourcingEventStatus } from '@/subapps/procurement/types/sourcing-event';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('SOURCING_EVENTS_API');

// ============================================================================
// SCHEMAS
// ============================================================================

const CreateSourcingEventSchema = z.object({
  projectId: z.string().min(1),
  buildingId: z.string().nullable().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  deadlineDate: z.string().nullable().optional(),
});

// ============================================================================
// GET — List events (excludes archived by default)
// ============================================================================

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const url = new URL(req.url);
        const status = url.searchParams.get('status') as SourcingEventStatus | null;
        const projectId = url.searchParams.get('projectId') ?? undefined;
        const search = url.searchParams.get('search') ?? undefined;

        const events = await listSourcingEvents(ctx, {
          status: status ?? undefined,
          projectId,
          search,
        });

        return NextResponse.json({ success: true, data: events });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to list sourcing events');
        logger.error('Sourcing events list error', { error: message });
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    },
  );
  return handler(request);
}

// ============================================================================
// POST — Create sourcing event (starts as draft)
// ============================================================================

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const parsed = safeParseBody(CreateSourcingEventSchema, await req.json());
        if (parsed.error) return parsed.error;
        const event = await createSourcingEvent(ctx, parsed.data);
        return NextResponse.json({ success: true, data: event }, { status: 201 });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to create sourcing event');
        logger.error('Sourcing event create error', { error: message });
        return NextResponse.json({ success: false, error: message }, { status: 400 });
      }
    },
  );
  return handler(request);
}

// ============================================================================
// EXPORTS
// ============================================================================

export const GET = withStandardRateLimit(handleGet);
export const POST = withSensitiveRateLimit(handlePost);
