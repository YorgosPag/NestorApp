/**
 * =============================================================================
 * File Archive API — Move files to archived state
 * =============================================================================
 *
 * POST /api/files/archive
 * Body: { fileIds: string[] }
 *
 * Moves files from active to archived state for long-term retention.
 * Archived files are hidden from active views but remain accessible.
 *
 * @module api/files/archive
 * @enterprise ADR-191 - Enterprise Document Management System (Phase 3.2)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { createModuleLogger } from '@/lib/telemetry';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { COLLECTIONS } from '@/config/firestore-collections';
import { readContainerState } from '@/lib/files/file-record-read';
import { fileResource } from '../_shared/file-ownership';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('FileArchiveRoute');

// ============================================================================
// TYPES
// ============================================================================

interface ArchiveRequest {
  fileIds: string[];
  action: 'archive' | 'unarchive';
}

interface ArchiveResponse {
  success: boolean;
  processedCount: number;
  errors: string[];
}

// ============================================================================
// HANDLER
// ============================================================================

async function handlePost(
  request: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse<ArchiveResponse>> {
  try {
    const body = (await request.json()) as ArchiveRequest;

    if (!body.fileIds || !Array.isArray(body.fileIds) || body.fileIds.length === 0) {
      return NextResponse.json(
        { success: false, processedCount: 0, errors: ['fileIds array is required'] },
        { status: 400 },
      );
    }

    if (body.fileIds.length > 50) {
      return NextResponse.json(
        { success: false, processedCount: 0, errors: ['Maximum 50 files per request'] },
        { status: 400 },
      );
    }

    const action = body.action || 'archive';
    const db = getAdminFirestore();
    let processedCount = 0;
    const errors: string[] = [];

    for (const fileId of body.fileIds) {
      try {
        // 🔒 ADR-862 Φ0 Β10 — Ο PEP ΠΟΥ ΕΛΕΙΠΕ. Η διαδρομή έγραφε σε `files/{id}` **χωρίς**
        //    έλεγχο μισθωτή: κάθε συνδεδεμένος αρχειοθετούσε/επανέφερε **ξένο** αρχείο με
        //    γνωστό id. Τώρα: φόρτωσε → υπάρχει; → δικό μου; σε **μία** πράξη (ADR-742), και
        //    ξένο = ανύπαρκτο (κανένα μαντείο ύπαρξης).
        const owned = await fileResource.load({
          docId: fileId,
          caller: ctx,
          action: `archive:${action}`,
          refusal: () => `${fileId}: not found`,
          db,
        });
        if (owned.refusal !== undefined) {
          errors.push(owned.refusal);
          continue;
        }
        const docRef = owned.doc.ref;
        const data = owned.doc.data;

        // Validate state transition
        if (action === 'archive' && data?.lifecycleState === 'archived') {
          continue; // Already archived, skip silently
        }
        if (action === 'unarchive' && data?.lifecycleState !== 'archived') {
          continue; // Not archived, skip silently
        }
        // 🔴 Β10 — Η ΑΝΤΙΚΑΤΕΣΤΗΜΕΝΗ ΕΚΔΟΣΗ ΔΕΝ «ΞΑΝΑΓΙΝΕΤΑΙ ΕΝΕΡΓΗ» ΜΕ ΕΝΑ ΚΛΙΚ. Δύο ενεργές
        //    εκδόσεις της ίδιας θέσης είναι ψέμα για το ποια ισχύει. Κατά Autodesk Docs η
        //    επαναφορά παλιάς έκδοσης είναι **αντίγραφο που προωθείται** ως νέα — ποτέ ανάσταση.
        if (action === 'unarchive' && readContainerState(data ?? {}).phase === 'SUPERSEDED') {
          errors.push(`${fileId}: superseded-restore-via-new-version`);
          continue;
        }

        const updateData: Record<string, string> = {
          lifecycleState: action === 'archive' ? 'archived' : 'active',
          updatedAt: nowISO(),
        };

        if (action === 'archive') {
          updateData.archivedAt = nowISO();
          updateData.archivedBy = ctx.uid;
        }

        await docRef.update(updateData);

        // Audit log
        const { generateAuditId } = await import('@/services/enterprise-id.service');
        await db.collection(COLLECTIONS.FILE_AUDIT_LOG).doc(generateAuditId()).set({
          fileId,
          action: 'archive',
          performedBy: ctx.uid,
          timestamp: nowISO(),
          metadata: {
            archiveAction: action,
          },
        });

        processedCount++;
      } catch (err) {
        const msg = getErrorMessage(err);
        errors.push(`${fileId}: ${msg}`);
        logger.error('Archive operation failed', { fileId, error: msg });
      }
    }

    logger.info('Archive operation complete', { action, processedCount, errors: errors.length });

    return NextResponse.json({
      success: true,
      processedCount,
      errors,
    });
  } catch (err) {
    const message = getErrorMessage(err, 'Archive failed');
    logger.error(`Archive error: ${message}`);
    return NextResponse.json(
      { success: false, processedCount: 0, errors: [message] },
      { status: 500 },
    );
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const POST = withStandardRateLimit(withAuth(handlePost));
