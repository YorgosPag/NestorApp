import 'server-only';

/**
 * @fileoverview **ΤΑ ΔΟΜΗΜΕΝΑ ΔΕΔΟΜΕΝΑ ΜΙΑΣ ΑΓΓΕΛΙΑΣ, ΣΤΟΝ ΔΙΑΚΟΜΙΣΤΗ** — ανάγνωση μέσα από το σύνορο, κρίση στο
 * καθαρό module (ADR-907 §10.10).
 * @related services/listings/public-listing-by-id.reader.ts · lib/listings/listing-video-structured-data.ts ·
 *   app/(light)/listing/[id]/page.tsx
 * @module services/listings/listing-structured-data.service
 *
 * 🔑 **ΚΑΝΕΝΑΣ ΝΕΟΣ ΑΝΑΓΝΩΣΤΗΣ.** Το `readPublicListingById` υπάρχει ήδη (τρεις καταναλωτές) και περνά από το
 * `publicListingFromDocument` (CHECK 3.74). Το δηλωμένο όριο του ADR-777 §8.11.7 #1 — «ανάγνωση στον διακομιστή
 * σημαίνει δεύτερο αναγνώστη» — γράφτηκε πριν γεννηθεί αυτός ο αναγνώστης.
 *
 * 🔴 **ΑΠΟΤΥΧΙΑ ⇒ `null`, ΠΟΤΕ 5xx.** Η σελίδα της αγγελίας ζωγραφίζει το περιεχόμενό της από τον **πελάτη**· τα
 * δομημένα δεδομένα είναι επαύξηση. Αν ο διακομιστής δεν μπόρεσε να ρωτήσει, ο επισκέπτης βλέπει την αγγελία
 * κανονικά και ο ανιχνευτής δεν μαθαίνει τίποτα — ποτέ το αντίστροφο. (Η `/area/[id]` κάνει 5xx γιατί εκεί η
 * ανάγνωση **είναι** η σελίδα.)
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { listingVideoStructuredData } from '@/lib/listings/listing-video-structured-data';
import type { JsonLdValue } from '@/lib/seo/json-ld';
import { createModuleLogger } from '@/lib/telemetry';
import { readPublicListingById } from '@/services/listings/public-listing-by-id.reader';

const logger = createModuleLogger('listing-structured-data.service');

/** Το JSON-LD της αγγελίας, ή `null`: δεν είναι δημοσιευμένη, δεν έχει τι να δηλώσει, ή δεν μπορέσαμε να ρωτήσουμε. */
export async function loadListingStructuredData(listingId: string): Promise<JsonLdValue | null> {
  try {
    // Μέσα στο `try`: διακομιστής χωρίς διαπιστευτήρια Admin δεν πρέπει να ρίχνει τη σελίδα.
    const listing = await readPublicListingById(getAdminFirestore(), listingId);
    return listing === null ? null : listingVideoStructuredData(listing);
  } catch (error) {
    logger.warn('Structured data skipped: public listing could not be read', { listingId, error });
    return null;
  }
}
