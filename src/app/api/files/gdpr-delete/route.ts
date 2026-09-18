/**
 * =============================================================================
 * GDPR Right to Erasure API — Delete all user file data
 * =============================================================================
 *
 * GDPR Article 17 — Right to Erasure (Right to be Forgotten).
 * Permanently deletes all file records, comments, shares, and audit entries
 * belonging to a user. Respects legal holds.
 *
 * 🔑 ADR-866 §2.6.9 Β6 — σαρώνει **και τα δύο** διαμερίσματα (`findSubjectFiles`), και δέχεται
 * **πολίτη χωρίς οργανισμό** (`withPersonalOrOrgAuth`): το δικαίωμα διαγραφής δεν εξαρτάται από
 * το αν ο άνθρωπος ανήκει σε εταιρεία.
 *
 * @module api/files/gdpr-delete
 * @enterprise ADR-191 Phase 3.5 — GDPR Compliance
 */

import { NextRequest, NextResponse } from 'next/server';
import { gdprSubjectRoute, type GdprSubject } from '../_shared/gdpr-subject-route';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { nowISO } from '@/lib/date-local';
import { deleteStorageObjectForPurge, isFileHeld } from '@/services/file-record/file-purge-helpers';
import { findSubjectActivity, findSubjectFiles } from '@/services/file-record/file-subject-scan';

/**
 * **Η δραστηριότητα του υποκειμένου μετά τη διαγραφή** (ADR-866 §2.6.11).
 *
 * | βιβλίο | πράξη | γιατί |
 * |---|---|---|
 * | εταιρικό | **ανωνυμοποίηση** `performedBy` | ό,τι ίσχυε: το βιβλίο ανήκει στην εταιρεία, που έχει έννομο συμφέρον να το κρατήσει |
 * | προσωπικό | **διαγραφή** | το βιβλίο υπάρχει **μόνο** για τον κάτοχο· κανείς άλλος υπεύθυνος δεν έχει λόγο να το κρατήσει |
 *
 * ⚠️ Γραμμές **αρχείων που μένουν** (δέσμευση/διατήρηση) **δεν** σβήνονται — η δραστηριότητα είναι
 * μέρος του τεκμηρίου που η δέσμευση προστατεύει.
 */
async function eraseSubjectActivity(
  adminDb: GdprSubject['db'],
  userId: string,
  retainedFileIds: ReadonlySet<string>,
): Promise<{ anonymized: number; deleted: number }> {
  const tally = { anonymized: 0, deleted: 0 };
  const batch = adminDb.batch();
  for (const { custody, doc } of await findSubjectActivity(adminDb, userId)) {
    if (custody === 'company') {
      batch.update(doc.ref, { performedBy: 'anonymized', performedByName: '[GDPR ANONYMIZED]' });
      tally.anonymized++;
    } else if (!retainedFileIds.has(String(doc.data().fileId))) {
      batch.delete(doc.ref);
      tally.deleted++;
    }
  }
  await batch.commit();
  return tally;
}

export const maxDuration = 60;

async function handler(request: NextRequest, { userId, db: adminDb }: GdprSubject): Promise<NextResponse> {
  try {
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
      activityDeleted: 0,
    };

    // 1. Delete files (respect holds) — ΚΑΙ ΤΑ ΔΥΟ διαμερίσματα (ADR-866 §2.6.9 Β6)
    const subjectFiles = await findSubjectFiles(adminDb, userId);

    const filesToPurge: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    // Αρχεία που ΜΕΝΟΥΝ (δέσμευση/διατήρηση) — μένει μαζί τους και η δραστηριότητά τους (άρθρο 17 §3).
    const retainedFileIds = new Set<string>();

    for (const { doc: fileDoc } of subjectFiles) {
      const data = fileDoc.data();
      // Skip files with legal/regulatory holds **ή** ενεργή διατήρηση (ΓΚΠΔ άρθρο 17 §3) — ο ΕΝΑΣ κριτής.
      // 🔴 ADR-864 §19: εδώ διαβαζόταν πεδίο `type` ΠΑΝΩ στο hold, ενώ το hold είναι **string** ⇒ κάθε αρχείο
      //    με `hold: 'none'` κρινόταν «σε δέσμευση» και **δεν σβηνόταν ποτέ** (υπερ-διατήρηση).
      if (isFileHeld(data)) {
        results.filesSkippedHold++;
        retainedFileIds.add(fileDoc.id);
        continue;
      }
      // Bytes πρώτα· άρνηση της πλατφόρμας (GCS hold) ⇒ η εγγραφή ΔΕΝ ανωνυμοποιείται ως «σβησμένη»
      // (ADR-864 §21 — ίδιος γραφέας με το purge).
      const storagePath = data.storagePath as string | undefined;
      if (storagePath && (await deleteStorageObjectForPurge(storagePath)) === 'refused') {
        results.filesSkippedHold++;
        retainedFileIds.add(fileDoc.id);
        continue;
      }
      filesToPurge.push(fileDoc);
    }

    const batch1 = adminDb.batch();
    for (const fileDoc of filesToPurge) {
      batch1.update(fileDoc.ref, {
        lifecycleState: 'purged',
        displayName: '[GDPR DELETED]',
        description: null,
        downloadUrl: null,
        storagePath: null,
        isDeleted: true,
        purgedAt: nowISO(),
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
      .where(FIELDS.CREATED_BY, '==', userId)
      .get();

    const batch3 = adminDb.batch();
    for (const shareDoc of sharesSnapshot.docs) {
      batch3.delete(shareDoc.ref);
      results.sharesDeleted++;
    }
    await batch3.commit();

    // 4. Δραστηριότητα αρχείων — ΚΑΙ ΤΑ ΔΥΟ βιβλία (ADR-866 §2.6.11), ίδιος σαρωτής με την εξαγωγή.
    const activity = await eraseSubjectActivity(adminDb, userId, retainedFileIds);
    results.auditAnonymized = activity.anonymized;
    results.activityDeleted = activity.deleted;

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

export const POST = withSensitiveRateLimit(gdprSubjectRoute(handler));
