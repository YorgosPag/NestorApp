/**
 * =============================================================================
 * GDPR Right to Erasure API — ο άνθρωπος φεύγει από τα αρχεία
 * =============================================================================
 *
 * GDPR Article 17 — Right to Erasure (Right to be Forgotten).
 *
 * 🔑 ADR-936 Στάδιο 1 — **δύο υπεύθυνοι, δύο πράξεις**: τα **προσωπικά** αρχεία σβήνονται· από τα **εταιρικά** φεύγει μόνο
 * ο άνθρωπος (ανωνυμοποίηση πεδίων δράστη) και το περιεχόμενο μένει στην εταιρεία. Δεσμεύσεις σέβονται. Η δουλειά ζει στο
 * `server/files/gdpr-erasure.server.ts`· εδώ μόνο επιβεβαίωση, απάντηση και η γραμμή ίχνους της ίδιας της διαγραφής.
 *
 * 🔑 ADR-866 §2.6.9 Β6 — δέχεται **πολίτη χωρίς οργανισμό** (`withPersonalOrOrgAuth`): το δικαίωμα διαγραφής δεν εξαρτάται
 * από το αν ο άνθρωπος ανήκει σε εταιρεία.
 *
 * ⚠️ Μερική αποτυχία δέσμης ⇒ 500 με τα `results` και τα `errors`: η **ίδια** κλήση ξανά ολοκληρώνει (όλα τα βήματα ιδεμπότητα).
 *
 * @module api/files/gdpr-delete
 * @enterprise ADR-191 Phase 3.5 — GDPR Compliance
 */

import { NextRequest, NextResponse } from 'next/server';
import { gdprSubjectRoute, type GdprSubject } from '../_shared/gdpr-subject-route';
import { COLLECTIONS } from '@/config/firestore-collections';
import { SYSTEM_IDENTITY } from '@/config/domain-constants';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { eraseSubjectFromFiles, type GdprErasureResults } from '@/server/files/gdpr-erasure.server';

export const maxDuration = 60;

/** Η φράση που πρέπει να στείλει ο άνθρωπος — πράξη μη αναστρέψιμη για τα προσωπικά του αρχεία. */
const CONFIRM_PHRASE = 'DELETE_ALL_MY_DATA';

/** Η γραμμή ίχνους της ίδιας της διαγραφής: **ποιος** ζήτησε, **τι** έγινε. */
async function recordErasure(db: GdprSubject['db'], userId: string, results: GdprErasureResults): Promise<void> {
  const { generateAuditId } = await import('@/services/enterprise-id.service');
  await db.collection(COLLECTIONS.FILE_AUDIT_LOG).doc(generateAuditId()).set({
    fileId: 'gdpr-erasure',
    action: 'gdpr_erasure',
    performedBy: SYSTEM_IDENTITY.ID,
    timestamp: new Date(),
    details: { userId, results },
  });
}

async function handler(request: NextRequest, { userId, db }: GdprSubject): Promise<NextResponse> {
  try {
    const { confirmPhrase } = await request.json();
    if (confirmPhrase !== CONFIRM_PHRASE) {
      return NextResponse.json(
        { error: `Confirmation required. Send { "confirmPhrase": "${CONFIRM_PHRASE}" }` },
        { status: 400 },
      );
    }

    const { results, listings, errors } = await eraseSubjectFromFiles(db, userId);
    await recordErasure(db, userId, results);

    if (errors.length > 0) {
      return NextResponse.json({ success: false, retryable: true, results, listings, errors }, { status: 500 });
    }
    return NextResponse.json({ success: true, gdprArticle: 'Article 17 — Right to Erasure', results, listings });
  } catch (error) {
    console.error('[GDPR Delete] Error:', error);
    return NextResponse.json({ error: 'Erasure failed' }, { status: 500 });
  }
}

export const POST = withSensitiveRateLimit(gdprSubjectRoute(handler));
