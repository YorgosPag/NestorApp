/**
 * GET   /api/procurement/sourcing-events/[eventId] — Get single sourcing event
 * PATCH /api/procurement/sourcing-events/[eventId] — Update sourcing event
 *
 * Auth: withAuth | Rate: standard (GET), sensitive (PATCH)
 * @see ADR-327 §17 step (d) Q31
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { z } from 'zod';
import { defineRoute, ok, notFound } from '@/lib/api/define-route';
import {
  getSourcingEvent,
  updateSourcingEvent,
} from '@/subapps/procurement/services/sourcing-event-service';
import { runProcurementMutation } from '../../_shared/procurement-mutation';
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

export const GET = defineRoute<z.ZodTypeAny, { eventId: string }>({
  rateLimit: 'standard',
  fallbackError: 'Failed to get sourcing event',
  handler: async ({ auth, params }) => {
    const event = await getSourcingEvent(auth, params.eventId);
    if (!event) notFound('Sourcing event not found');
    return ok(event);
  },
});

// ============================================================================
// PATCH — Update fields or trigger status transition
// ============================================================================

export const PATCH = defineRoute<z.ZodTypeAny, { eventId: string }>({
  rateLimit: 'sensitive',
  handler: ({ req, auth, params }) =>
    runProcurementMutation({
      req,
      schema: UpdateSourcingEventSchema,
      logger,
      logMessage: 'Sourcing event update error',
      logContext: { eventId: params.eventId },
      fallbackError: 'Failed to update sourcing event',
      run: async (data) => ok(await updateSourcingEvent(auth, params.eventId, data)),
    }),
});
