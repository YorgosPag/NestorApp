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
import { defineRoute, ok, created } from '@/lib/api/define-route';
import {
  listSourcingEvents,
  createSourcingEvent,
} from '@/subapps/procurement/services/sourcing-event-service';
import type { SourcingEventStatus } from '@/subapps/procurement/types/sourcing-event';
import { getErrorMessage } from '@/lib/error-utils';
import { safeJsonBody } from '@/lib/validation/shared-schemas';
import { rethrowProcurementFailure } from '../_shared/procurement-error-outcome';
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
  fallbackError: 'Failed to create sourcing event',
  handler: async ({ req, auth }) => {
    try {
      const parsed = await safeJsonBody(CreateSourcingEventSchema, req);
      if (parsed.error) return parsed.error;
      const event = await createSourcingEvent(auth, parsed.data);
      return created(event);
    } catch (error) {
      logger.error('Sourcing event create error', { error: getErrorMessage(error, 'Failed to create sourcing event') });
      rethrowProcurementFailure(error, auth.globalRole, 'Failed to create sourcing event');
    }
  },
});
