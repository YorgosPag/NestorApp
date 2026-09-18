/**
 * =============================================================================
 * GDPR Data Export API — Export all user file data
 * =============================================================================
 *
 * GDPR Article 20 — Right to Data Portability.
 * Exports all files and metadata belonging to a user as a JSON manifest
 * with download URLs for the actual files.
 *
 * 🔑 ADR-866 §2.6.9 Β6 — **ίδιος σαρωτής** με το `gdpr-delete` (`findSubjectFiles`), και τα δύο
 * διαμερίσματα: ό,τι θα σβηστεί είναι ακριβώς ό,τι δείχνει η εξαγωγή. Κάθε αρχείο φέρει `custody`.
 *
 * @module api/files/gdpr-export
 * @enterprise ADR-191 Phase 3.5 — GDPR Compliance
 */

import { NextRequest, NextResponse } from 'next/server';
import { gdprSubjectRoute, type GdprSubject } from '../_shared/gdpr-subject-route';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { nowISO } from '@/lib/date-local';
import { findSubjectActivity, findSubjectFiles } from '@/services/file-record/file-subject-scan';

export const maxDuration = 60;

async function handler(_request: NextRequest, { userId, db: adminDb }: GdprSubject): Promise<NextResponse> {
  try {

    // All files of this subject — ΚΑΙ ΤΑ ΔΥΟ διαμερίσματα (ADR-866 §2.6.9 Β6)
    const subjectFiles = await findSubjectFiles(adminDb, userId);

    const files = subjectFiles.map(({ custody, doc }) => {
      const data = doc.data();
      return {
        id: doc.id,
        custody,
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

    // 📒 ADR-866 §2.6.11 — η δραστηριότητα αρχείων σε ΟΛΑ τα βιβλία (ίδιος σαρωτής με τη διαγραφή).
    //    ⚠️ Χωρίς το παλιό `limit(500)`: η εξαγωγή του άρθρου 20 είναι **όλα** τα δεδομένα, όχι δείγμα.
    const auditEntries = (await findSubjectActivity(adminDb, userId)).map(({ custody, doc }) => {
      const data = doc.data();
      return {
        id: doc.id,
        custody,
        action: data.action ?? null,
        fileId: data.fileId ?? null,
        performedBy: data.performedBy ?? null,
        timestamp: data.timestamp?.toDate?.()?.toISOString() ?? data.timestamp ?? null,
        metadata: data.metadata ?? data.details ?? null,
      };
    });

    // Query comments by this user
    const commentsSnapshot = await adminDb
      .collection(COLLECTIONS.FILE_COMMENTS)
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
      .collection(COLLECTIONS.FILE_SHARES)
      .where(FIELDS.CREATED_BY, '==', userId)
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
      exportDate: nowISO(),
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
        'Content-Disposition': `attachment; filename="gdpr-export-${userId}-${nowISO().slice(0, 10)}.json"`,
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

export const POST = withSensitiveRateLimit(gdprSubjectRoute(handler));
