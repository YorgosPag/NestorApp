/**
 * POST /api/procurement/sourcing-events/[eventId]/archive — Archive sourcing event
 *
 * Triggers status transition → 'archived' (irreversible).
 *
 * Auth: withAuth | Rate: sensitive
 * @see ADR-327 §17 step (d) Q31
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { archiveSourcingEvent } from '@/subapps/procurement/services/sourcing-event-service';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('SOURCING_EVENT_ARCHIVE_API');

// ============================================================================
// POST — Archive (transition to 'archived', no body required)
// ============================================================================

async function handlePost(
  request: NextRequest,
  segmentData?: { params: Promise<{ eventId: string }> },
): Promise<NextResponse> {
  const { eventId } = await segmentData!.params;
  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        await archiveSourcingEvent(ctx, eventId);
        return NextResponse.json({ success: true, message: 'Sourcing event archived' });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to archive sourcing event');
        logger.error('Sourcing event archive error', { eventId, error: message });
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
