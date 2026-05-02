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

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { requireProjectInTenant } from '@/lib/auth/tenant-isolation';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { nowISO } from '@/lib/date-local';

const EfkaDeclarationSchema = z.object({
  employerVatNumber: z.string().max(20).nullable().optional(),
  projectAddress: z.string().max(500).nullable().optional(),
  projectDescription: z.string().max(2000).nullable().optional(),
  startDate: z.string().max(30).nullable().optional(),
  estimatedEndDate: z.string().max(30).nullable().optional(),
  estimatedWorkerCount: z.number().int().min(0).max(9999).nullable().optional(),
  projectCategory: z.string().max(50).nullable().optional(),
  status: z.string().max(50).optional(),
}).passthrough();

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
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      await requireProjectInTenant({ ctx, projectId, path: '/api/projects/[projectId]/efka-declaration' });

      try {
        const parsed = safeParseBody(EfkaDeclarationSchema, await req.json());
        if (parsed.error) return parsed.error;
        const body = parsed.data;

        if (Object.keys(body).length === 0) {
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
          updatedAt: nowISO(),
        };

        await projectRef.update({
          efkaDeclaration: mergedDeclaration,
          updatedAt: FieldValue.serverTimestamp(),
        });

        await logAuditEvent(ctx, 'data_updated', projectId, 'project', {
          metadata: { reason: 'EFKA declaration updated (κρατική δήλωση)' },
        }).catch(() => {/* non-blocking */});

        // Per-entity audit trail (feeds the project "Ιστορικό" tab via ADR-195).
        // Only the changed top-level keys of the declaration are emitted to
        // keep the timeline signal-to-noise high — full declaration snapshot
        // is still recoverable from the project document itself.
        const declarationChanges = Object.keys(body).map((field) => ({
          field: `efkaDeclaration.${field}`,
          oldValue:
            typeof (currentDeclaration as Record<string, unknown>)[field] === 'string' ||
            typeof (currentDeclaration as Record<string, unknown>)[field] === 'number' ||
            typeof (currentDeclaration as Record<string, unknown>)[field] === 'boolean'
              ? ((currentDeclaration as Record<string, unknown>)[field] as string | number | boolean)
              : null,
          newValue:
            typeof (body as Record<string, unknown>)[field] === 'string' ||
            typeof (body as Record<string, unknown>)[field] === 'number' ||
            typeof (body as Record<string, unknown>)[field] === 'boolean'
              ? ((body as Record<string, unknown>)[field] as string | number | boolean)
              : null,
          label: `efkaDeclaration.${field}`,
        }));

        await EntityAuditService.recordChange({
          entityType: ENTITY_TYPES.PROJECT,
          entityId: projectId,
          entityName: (projectData?.name as string | undefined) ?? null,
          action: 'updated',
          changes: declarationChanges,
          performedBy: ctx.uid,
          performedByName: ctx.email ?? null,
          companyId: (projectData?.companyId as string | undefined) ?? ctx.companyId,
        });

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
