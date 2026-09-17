/**
 * =============================================================================
 * Η ΜΙΑ ΕΙΣΟΔΟΣ ΤΩΝ ΔΙΑΔΡΟΜΩΝ ΓΚΠΔ — «ΠΟΙΟΣ ΕΙΝΑΙ ΤΟ ΥΠΟΚΕΙΜΕΝΟ;» (ADR-866 §2.6.9 Β6)
 * =============================================================================
 *
 * `gdpr-export` (άρθρα 15/20) και `gdpr-delete` (άρθρο 17) ρωτούν το **ίδιο** πράγμα πριν από
 * οτιδήποτε άλλο: *ποιος ζητά, και πού είναι η βάση;* — και ήταν γραμμένα ως **δίδυμα** (CHECK 3.28,
 * μετρημένο όταν το 2β.3 τα άγγιξε και τα δύο).
 *
 * 🔑 **Το υποκείμενο είναι ΠΑΝΤΑ η επαληθευμένη ταυτότητα** — ποτέ `userId` από το αίτημα. Και η
 * πόρτα δέχεται **πολίτη χωρίς οργανισμό** (`withPersonalOrOrgAuth`): τα δικαιώματα του ΓΚΠΔ δεν
 * εξαρτώνται από το αν ο άνθρωπος ανήκει σε εταιρεία.
 *
 * ⚠️ Το όριο ρυθμού μένει **στη διαδρομή** (`withSensitiveRateLimit`), όπου το διαβάζει η CHECK 3.78.
 *
 * @module app/api/files/_shared/gdpr-subject-route
 * @see services/file-record/file-subject-scan — ποια αρχεία είναι του υποκειμένου
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';

import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

/** Το υποκείμενο του αιτήματος ΓΚΠΔ και η σύνδεση με τη βάση. */
export interface GdprSubject {
  /** Η **επαληθευμένη** ταυτότητα — το μόνο φίλτρο υποκειμένου. */
  readonly userId: string;
  readonly db: Firestore;
}

export type GdprSubjectHandler = (request: NextRequest, subject: GdprSubject) => Promise<NextResponse>;

/** Τυλίγει χειριστή ΓΚΠΔ: ταυτότητα (πολίτης ή μέλος) → βάση → χειριστής. */
export function gdprSubjectRoute(
  handler: GdprSubjectHandler,
): (request: NextRequest) => Promise<NextResponse> {
  return withPersonalOrOrgAuth(async (request: NextRequest, actor: ApiActor) => {
    const db = getAdminFirestore();
    if (!db) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    return handler(request, { userId: actor.ctx.uid, db });
  });
}
