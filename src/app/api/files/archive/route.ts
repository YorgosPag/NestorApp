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
import { COLLECTIONS } from '@/config/firestore-collections';

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
        const docRef = db.collection(COLLECTIONS.FILES).doc(fileId);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
          errors.push(`${fileId}: not found`);
          continue;
        }

        const data = docSnap.data();

        // Validate state transition
        if (action === 'archive' && data?.lifecycleState === 'archived') {
          continue; // Already archived, skip silently
        }
        if (action === 'unarchive' && data?.lifecycleState !== 'archived') {
          continue; // Not archived, skip silently
        }

        const updateData: Record<string, string> = {
          lifecycleState: action === 'archive' ? 'archived' : 'active',
          updatedAt: new Date().toISOString(),
        };

        if (action === 'archive') {
          updateData.archivedAt = new Date().toISOString();
          updateData.archivedBy = ctx.uid;
        }

        await docRef.update(updateData);

        // Audit log
        await db.collection(COLLECTIONS.FILE_AUDIT_LOG).add({
          fileId,
          action: 'archive',
          performedBy: ctx.uid,
          timestamp: new Date().toISOString(),
          metadata: {
            archiveAction: action,
          },
        });

        processedCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
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
    const message = err instanceof Error ? err.message : 'Archive failed';
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

export const POST = withAuth(handlePost);
