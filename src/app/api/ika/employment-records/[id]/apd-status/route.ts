/**
 * =============================================================================
 * PATCH /api/ika/employment-records/[id]/apd-status — Update APD status
 * =============================================================================
 *
 * Migrated from client-side write (useEmploymentRecords.ts) to server-side.
 *
 * @module api/ika/employment-records/[id]/apd-status
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System
 * @security SPEC-255C — Client-Side Writes Migration (CRITICAL)
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';

type SegmentData = { params: Promise<{ id: string }> };

const PatchApdStatusSchema = z.object({
  status: z.enum(['pending', 'submitted', 'accepted', 'rejected']),
  referenceNumber: z.string().max(100).optional(),
});

// =============================================================================
// PATCH — Update APD Status
// =============================================================================

async function handlePatch(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { id } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const parsed = safeParseBody(PatchApdStatusSchema, await req.json());
        if (parsed.error) return parsed.error;
        const body = parsed.data;

        const db = getAdminFirestore();
        const docRef = db.collection(COLLECTIONS.EMPLOYMENT_RECORDS).doc(id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
          return NextResponse.json(
            { success: false, error: 'Employment record not found' },
            { status: 404 }
          );
        }

        const now = new Date().toISOString();
        const updateData: Record<string, unknown> = {
          apdStatus: body.status,
          updatedAt: now,
        };

        if (body.status === 'submitted') {
          updateData.apdSubmissionDate = now;
        }

        if (body.referenceNumber !== undefined) {
          updateData.apdReferenceNumber = body.referenceNumber;
        }

        await docRef.update(updateData);

        await logAuditEvent(ctx, 'data_updated', id, 'project', {
          metadata: { reason: `APD status → ${body.status}` },
        }).catch(() => {/* non-blocking */});

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to update APD status');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const PATCH = withStandardRateLimit(handlePatch);
