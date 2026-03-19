/**
 * =============================================================================
 * GDPR Right to Erasure API — Delete all user file data
 * =============================================================================
 *
 * GDPR Article 17 — Right to Erasure (Right to be Forgotten).
 * Permanently deletes all file records, comments, shares, and audit entries
 * belonging to a user. Respects legal holds.
 *
 * @module api/files/gdpr-delete
 * @enterprise ADR-191 Phase 3.5 — GDPR Compliance
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';

export const maxDuration = 60;

async function handler(
  request: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse> {
  try {
    const userId = ctx.uid;
    const adminDb = getAdminFirestore();
    if (!adminDb) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    const { confirmPhrase } = await request.json();

    // Safety: require explicit confirmation
    if (confirmPhrase !== 'DELETE_ALL_MY_DATA') {
      return NextResponse.json(
        { error: 'Confirmation required. Send { "confirmPhrase": "DELETE_ALL_MY_DATA" }' },
        { status: 400 }
      );
    }

    const results = {
      filesDeleted: 0,
      filesSkippedHold: 0,
      commentsDeleted: 0,
      sharesDeleted: 0,
      auditAnonymized: 0,
    };

    // 1. Delete files (respect holds)
    const filesSnapshot = await adminDb
      .collection(COLLECTIONS.FILES)
      .where('createdBy', '==', userId)
      .get();

    const batch1 = adminDb.batch();
    for (const fileDoc of filesSnapshot.docs) {
      const data = fileDoc.data();
      // Skip files with legal/regulatory holds
      if (data.hold && data.hold.type !== 'none') {
        results.filesSkippedHold++;
        continue;
      }
      batch1.update(fileDoc.ref, {
        lifecycleState: 'purged',
        displayName: '[GDPR DELETED]',
        description: null,
        downloadUrl: null,
        isDeleted: true,
        purgedAt: new Date().toISOString(),
        purgedBy: 'gdpr-erasure',
      });
      results.filesDeleted++;
    }
    await batch1.commit();

    // 2. Delete comments
    const commentsSnapshot = await adminDb
      .collection(COLLECTIONS.FILE_COMMENTS)
      .where('authorId', '==', userId)
      .get();

    const batch2 = adminDb.batch();
    for (const commentDoc of commentsSnapshot.docs) {
      batch2.delete(commentDoc.ref);
      results.commentsDeleted++;
    }
    await batch2.commit();

    // 3. Delete shares
    const sharesSnapshot = await adminDb
      .collection(COLLECTIONS.FILE_SHARES)
      .where('createdBy', '==', userId)
      .get();

    const batch3 = adminDb.batch();
    for (const shareDoc of sharesSnapshot.docs) {
      batch3.delete(shareDoc.ref);
      results.sharesDeleted++;
    }
    await batch3.commit();

    // 4. Anonymize audit log (keep for compliance but remove PII)
    const auditSnapshot = await adminDb
      .collection(COLLECTIONS.FILE_AUDIT_LOG)
      .where('performedBy', '==', userId)
      .get();

    const batch4 = adminDb.batch();
    for (const auditDoc of auditSnapshot.docs) {
      batch4.update(auditDoc.ref, {
        performedBy: 'anonymized',
        performedByName: '[GDPR ANONYMIZED]',
      });
      results.auditAnonymized++;
    }
    await batch4.commit();

    // Write GDPR erasure audit entry
    const { generateAuditId } = await import('@/services/enterprise-id.service');
    await adminDb.collection(COLLECTIONS.FILE_AUDIT_LOG).doc(generateAuditId()).set({
      fileId: 'gdpr-erasure',
      action: 'gdpr_erasure',
      performedBy: 'system',
      timestamp: new Date(),
      details: {
        userId,
        results,
      },
    });

    return NextResponse.json({
      success: true,
      gdprArticle: 'Article 17 — Right to Erasure',
      results,
    });
  } catch (error) {
    console.error('[GDPR Delete] Error:', error);
    return NextResponse.json(
      { error: 'Erasure failed' },
      { status: 500 }
    );
  }
}

export const POST = withSensitiveRateLimit(withAuth(handler));
