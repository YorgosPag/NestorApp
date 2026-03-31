/**
 * =============================================================================
 * POST /api/contacts/[contactId]/name-cascade — Contact Name Cascade
 * =============================================================================
 *
 * Propagates a contact's display name change to all denormalized locations:
 * - units.commercial.owners[].name (ADR-244: via ownerContactIds array-contains query)
 * - payment_plans.ownerName (subcollection)
 *
 * Called client-side from contacts.service.ts after updateContactFromForm().
 *
 * @module api/contacts/[contactId]/name-cascade
 * @enterprise ADR-249 SPEC-249B — Name Cascade & Data Quality (P1-1/P1-2)
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { propagateContactNameChange } from '@/lib/firestore/cascade-propagation.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('ContactNameCascadeRoute');

// =============================================================================
// TYPES
// =============================================================================

interface NameCascadeBody {
  newDisplayName: string;
}

// =============================================================================
// POST — Trigger Name Cascade
// =============================================================================

async function handlePost(
  request: NextRequest,
  segmentData?: { params: Promise<{ contactId: string }> }
): Promise<NextResponse> {
  const { contactId } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const body = (await req.json()) as NameCascadeBody;

        if (!body.newDisplayName || typeof body.newDisplayName !== 'string') {
          return NextResponse.json(
            { success: false, error: 'newDisplayName is required and must be a string' },
            { status: 400 }
          );
        }

        const trimmedName = body.newDisplayName.trim();
        if (trimmedName.length === 0) {
          return NextResponse.json(
            { success: false, error: 'newDisplayName cannot be empty' },
            { status: 400 }
          );
        }

        logger.info('Contact name cascade triggered', { contactId, newDisplayName: trimmedName });

        const result = await propagateContactNameChange(contactId, trimmedName);

        return NextResponse.json({
          success: true,
          data: {
            contactId,
            totalUpdated: result.totalUpdated,
            collections: result.collections,
          },
        });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to cascade contact name');
        logger.error('Contact name cascade failed', { contactId, error: message });
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
