/**
 * =============================================================================
 * GDPR Data Export API — Export all user file data
 * =============================================================================
 *
 * GDPR Article 20 — Right to Data Portability.
 * Exports all files and metadata belonging to a user as a JSON manifest
 * with download URLs for the actual files.
 *
 * @module api/files/gdpr-export
 * @enterprise ADR-191 Phase 3.5 — GDPR Compliance
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedContext } from '@/lib/api-middleware';
import { adminDb } from '@/lib/firebase-admin';

export const maxDuration = 60;

async function handler(
  _request: NextRequest,
  ctx: AuthenticatedContext
): Promise<NextResponse> {
  try {
    const userId = ctx.uid;

    // Query all files created by this user
    const filesSnapshot = await adminDb
      .collection('files')
      .where('createdBy', '==', userId)
      .get();

    const files = filesSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        displayName: data.displayName ?? null,
        originalFilename: data.originalFilename ?? null,
        contentType: data.contentType ?? null,
        sizeBytes: data.sizeBytes ?? null,
        category: data.category ?? null,
        domain: data.domain ?? null,
        classification: data.classification ?? null,
        description: data.description ?? null,
        downloadUrl: data.downloadUrl ?? null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        entityType: data.entityType ?? null,
        entityId: data.entityId ?? null,
        lifecycleState: data.lifecycleState ?? 'active',
      };
    });

    // Query audit log entries for this user
    const auditSnapshot = await adminDb
      .collection('file_audit_log')
      .where('performedBy', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(500)
      .get();

    const auditEntries = auditSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        action: data.action ?? null,
        fileId: data.fileId ?? null,
        timestamp: data.timestamp?.toDate?.()?.toISOString() ?? null,
        details: data.details ?? null,
      };
    });

    // Query comments by this user
    const commentsSnapshot = await adminDb
      .collection('file_comments')
      .where('authorId', '==', userId)
      .get();

    const comments = commentsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        fileId: data.fileId ?? null,
        text: data.text ?? null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
      };
    });

    // Query shares created by this user
    const sharesSnapshot = await adminDb
      .collection('file_shares')
      .where('createdBy', '==', userId)
      .get();

    const shares = sharesSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        fileId: data.fileId ?? null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        expiresAt: data.expiresAt?.toDate?.()?.toISOString() ?? null,
        downloadCount: data.downloadCount ?? 0,
      };
    });

    const exportData = {
      exportDate: new Date().toISOString(),
      userId,
      gdprArticle: 'Article 20 — Right to Data Portability',
      data: {
        files: {
          count: files.length,
          items: files,
        },
        auditLog: {
          count: auditEntries.length,
          items: auditEntries,
        },
        comments: {
          count: comments.length,
          items: comments,
        },
        shares: {
          count: shares.length,
          items: shares,
        },
      },
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="gdpr-export-${userId}-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    console.error('[GDPR Export] Error:', error);
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handler);
