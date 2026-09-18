import 'server-only';

/**
 * @fileoverview **Ο ΤΙΤΛΟΣ ΜΙΑΣ ΑΓΓΕΛΙΑΣ ΓΙΑ ΜΗΝΥΜΑ ΠΡΟΣ ΑΝΘΡΩΠΟ** — ειδοποίηση, θέμα email.
 * @related ADR-867 Β6 (N.0.2 — ήταν γραμμένο **δύο** φορές: `mandate-request-notifier` ·
 *   `stay-booking-notifier`· τρίτος καταναλωτής ο `network-notifier`) · ADR-839 (το σύνορο ανάγνωσης)
 * @module lib/listings/listing-notice-title
 *
 * 🔑 **Από τη ΔΗΜΟΣΙΑ προβολή**, όχι από το ωμό έγγραφο: είναι ό,τι βλέπει ο κόσμος, και η μόνη
 * πηγή που δεν χρειάζεται δεύτερη απόφαση αποκάλυψης. Περνά από το **σύνορο**
 * (`publicListingFromDocument`, CHECK 3.74) — ποτέ `data() as PublicListing`.
 *
 * ⚠️ **ΠΟΤΕ κενό**: ένα «αίτημα για «»» δεν λέει **ποια** αγγελία. Σειρά εφεδρείας: δημόσιος τίτλος →
 * ο τίτλος που ξέρει ήδη ο καλών (π.χ. του εγγράφου ιδιοκτησίας) → το αναγνωριστικό.
 *
 * ⚠️ **ΠΟΤΕ δεν πετά**: ο τίτλος είναι **διακόσμηση** μηνύματος — μια αποτυχία ανάγνωσης δεν
 * επιτρέπεται να ακυρώσει την ειδοποίηση που τον χρειάζεται.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { publicListingFromDocument } from '@/lib/listings/public-listing-from-document';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('listing-notice-title');

/** Η σειρά εφεδρείας, καθαρή — ώστε να ελέγχεται χωρίς Firestore. */
export function pickNoticeTitle(
  publicTitle: unknown,
  fallbackTitle: string | undefined,
  ownerPropertyId: string,
): string {
  if (typeof publicTitle === 'string' && publicTitle.trim() !== '') return publicTitle.trim();
  const fallback = fallbackTitle?.trim() ?? '';
  return fallback !== '' ? fallback : ownerPropertyId;
}

/**
 * **Ο τίτλος της αγγελίας για μήνυμα** — ποτέ κενός, ποτέ σφάλμα.
 *
 * @param fallbackTitle ό,τι ξέρει ήδη ο καλών (π.χ. `OwnerProperty.title`) — πριν από το αναγνωριστικό.
 */
export async function listingNoticeTitle(
  adminDb: AdminFirestore,
  ownerPropertyId: string,
  fallbackTitle?: string,
): Promise<string> {
  try {
    const snapshot = await adminDb.collection(COLLECTIONS.PUBLIC_LISTINGS).doc(ownerPropertyId).get();
    // ⚠️ Ο έλεγχος `unknown` μένει: η αλυσίδα του συνόρου εγγυάται τα πεδία που **πρόσθεσε** (v2+)·
    //    για τα αρχικά της v1 η εγγύηση είναι ο γραφέας. Εδώ ο τίτλος ταξιδεύει σε μήνυμα προς
    //    άνθρωπο, όπου ένα `undefined.trim()` θα έριχνε ολόκληρη την ειδοποίηση.
    const title: unknown = publicListingFromDocument(snapshot.data(), ownerPropertyId)?.title;
    return pickNoticeTitle(title, fallbackTitle, ownerPropertyId);
  } catch (error) {
    logger.warn('Ο τίτλος της αγγελίας δεν διαβάστηκε — το μήνυμα φεύγει με εφεδρεία', {
      data: { ownerPropertyId },
      error: error instanceof Error ? error.message : String(error),
    });
    return pickNoticeTitle(undefined, fallbackTitle, ownerPropertyId);
  }
}
