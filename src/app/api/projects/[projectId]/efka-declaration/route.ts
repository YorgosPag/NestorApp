/**
 * =============================================================================
 * PATCH /api/projects/[projectId]/efka-declaration — Update EFKA declaration
 * =============================================================================
 *
 * Migrated from client-side write (useEfkaDeclaration.ts) to server-side
 * for: validation, tenant isolation, audit trail.
 *
 * EFKA declaration is stored as sub-object on the project document.
 *
 * @module api/projects/[projectId]/efka-declaration
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System
 * @security SPEC-255C — Client-Side Writes Migration (CRITICAL)
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { requireProjectInTenant } from '@/lib/auth/tenant-isolation';
import { getErrorMessage } from '@/lib/error-utils';

type SegmentData = { params: Promise<{ projectId: string }> };

// =============================================================================
// PATCH — Update EFKA Declaration
// =============================================================================

async function handlePatch(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { projectId } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, cache: PermissionCache): Promise<NextResponse> => {
      await requireProjectInTenant({ ctx, cache, projectId, path: '/api/projects/[projectId]/efka-declaration' });

      try {
        const body = (await req.json()) as Record<string, unknown>;

        if (!body || Object.keys(body).length === 0) {
          return NextResponse.json(
            { success: false, error: 'No update fields provided' },
            { status: 400 }
          );
        }

        const db = getAdminFirestore();
        const projectRef = db.collection(COLLECTIONS.PROJECTS).doc(projectId);
        const projectDoc = await projectRef.get();

        if (!projectDoc.exists) {
          return NextResponse.json(
            { success: false, error: 'Project not found' },
            { status: 404 }
          );
        }

        const projectData = projectDoc.data();
        const currentDeclaration = projectData?.efkaDeclaration ?? {};

        // Merge updates into existing declaration
        const mergedDeclaration = {
          ...currentDeclaration,
          ...body,
          updatedAt: new Date().toISOString(),
        };

        await projectRef.update({
          efkaDeclaration: mergedDeclaration,
          updatedAt: FieldValue.serverTimestamp(),
        });

        await logAuditEvent(ctx, 'data_updated', projectId, 'project', {
          metadata: { reason: 'EFKA declaration updated (κρατική δήλωση)' },
        }).catch(() => {/* non-blocking */});

        return NextResponse.json({ success: true, data: mergedDeclaration });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to update EFKA declaration');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const PATCH = withStandardRateLimit(handlePatch);
