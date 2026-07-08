/**
 * POST /api/procurement/sourcing-events/[eventId]/archive — Archive sourcing event
 *
 * Triggers status transition → 'archived' (irreversible).
 *
 * Auth: withAuth | Rate: sensitive
 * @see ADR-327 §17 step (d) Q31
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import type { z } from 'zod';
import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/define-route';
import { archiveSourcingEvent } from '@/subapps/procurement/services/sourcing-event-service';
import { runProcurementMutation } from '../../../_shared/procurement-mutation';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('SOURCING_EVENT_ARCHIVE_API');

// ============================================================================
// POST — Archive (transition to 'archived', no body required)
// ============================================================================

export const POST = defineRoute<z.ZodTypeAny, { eventId: string }>({
  rateLimit: 'sensitive',
  handler: ({ auth, params, req }) =>
    runProcurementMutation({
      req,
      logger,
      logMessage: 'Sourcing event archive error',
      logContext: { eventId: params.eventId },
      fallbackError: 'Failed to archive sourcing event',
      run: async () => {
        await archiveSourcingEvent(auth, params.eventId);
        return NextResponse.json({ success: true, message: 'Sourcing event archived' });
      },
    }),
});
