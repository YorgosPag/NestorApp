/**
 * GET  /api/procurement/sourcing-events — List sourcing events
 * POST /api/procurement/sourcing-events — Create sourcing event
 *
 * Query params (GET): status, projectId, search
 *
 * Auth: withAuth | Rate: standard (GET), sensitive (POST)
 * @see ADR-327 §17 step (d) Q31
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { z } from 'zod';
import { defineRoute, ok, created, httpError } from '@/lib/api/define-route';
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

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to list sourcing events',
  handler: async ({ req, auth }) => {
    const url = new URL(req.url);
    const status = url.searchParams.get('status') as SourcingEventStatus | null;
    const projectId = url.searchParams.get('projectId') ?? undefined;
    const search = url.searchParams.get('search') ?? undefined;

    const events = await listSourcingEvents(auth, {
      status: status ?? undefined,
      projectId,
      search,
    });

    return ok(events);
  },
});

// ============================================================================
// POST — Create sourcing event (starts as draft; all errors → flat 400)
// ============================================================================

export const POST = defineRoute({
  rateLimit: 'sensitive',
  handler: async ({ req, auth }) => {
    try {
      const parsed = safeParseBody(CreateSourcingEventSchema, await req.json());
      if (parsed.error) return parsed.error;
      const event = await createSourcingEvent(auth, parsed.data);
      return created(event);
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to create sourcing event');
      logger.error('Sourcing event create error', { error: message });
      httpError(400, message);
    }
  },
});
