/**
 * =============================================================================
 * GET  /api/accounting/apy-certificates/[id] — Get APY Certificate
 * PATCH /api/accounting/apy-certificates/[id] — Update APY Certificate
 * =============================================================================
 *
 * GET: Returns a single APY certificate by ID.
 * PATCH: Updates mutable fields only: isReceived, receivedAt, notes.
 *   Immutable fields (lineItems, totals, provider, customer) cannot be changed after creation.
 *
 * Auth: withAuth (authenticated users)
 * Rate: GET → withStandardRateLimit | PATCH → withSensitiveRateLimit
 *
 * @module api/accounting/apy-certificates/[id]
 * @enterprise ADR-ACC-020 Βεβαίωση Παρακράτησης Φόρου
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import {
  withStandardRateLimit,
  withSensitiveRateLimit,
} from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('APY_CERTIFICATE_DETAIL');

// =============================================================================
// TYPES
// =============================================================================

/** Only mutable fields are patchable — immutable fields are rejected */
interface PatchAPYCertificateBody {
  isReceived?: boolean;
  receivedAt?: string | null;
  notes?: string | null;
}

// =============================================================================
// GET — Single Certificate
// =============================================================================

async function handleGet(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await segmentData!.params;

  const handler = withAuth(
    async (_req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
        const cert = await repository.getAPYCertificate(id);

        if (!cert) {
          return NextResponse.json(
            { success: false, error: 'APY certificate not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({ success: true, data: cert });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to get APY certificate');
        logger.error('APY certificate get error', { id, error: message });
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

// =============================================================================
// PATCH — Update Mutable Fields
// =============================================================================

async function handlePatch(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        let body: PatchAPYCertificateBody;
        try {
          body = (await req.json()) as PatchAPYCertificateBody;
        } catch {
          return NextResponse.json(
            { success: false, error: 'Invalid JSON body' },
            { status: 400 }
          );
        }

        const { repository } = createAccountingServices();

        // Verify exists
        const existing = await repository.getAPYCertificate(id);
        if (!existing) {
          return NextResponse.json(
            { success: false, error: 'APY certificate not found' },
            { status: 404 }
          );
        }

        // Only allow mutable fields
        const allowedUpdates: PatchAPYCertificateBody = {};
        if (body.isReceived !== undefined) allowedUpdates.isReceived = body.isReceived;
        if (body.receivedAt !== undefined) allowedUpdates.receivedAt = body.receivedAt;
        if (body.notes !== undefined) allowedUpdates.notes = body.notes;

        await repository.updateAPYCertificate(id, allowedUpdates);

        logger.info('APY certificate updated', { id, updates: Object.keys(allowedUpdates) });

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to update APY certificate');
        logger.error('APY certificate update error', { id, error: message });
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);
export const PATCH = withSensitiveRateLimit(handlePatch);
