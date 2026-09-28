import 'server-only';

/**
 * @fileoverview **ΜΙΑ ΔΗΜΟΣΙΑ ΑΓΓΕΛΙΑ ΚΑΤΑ ΤΑΥΤΟΤΗΤΑ, ΑΠΟ ΤΟΝ SERVER** — μέσα από το σύνορο ανάγνωσης
 * (`publicListingFromDocument`, CHECK 3.74).
 * @related `live-public-listings.reader.ts` (όλες οι ζωντανές) · ADR-890 Φ2 (τιμές συμβολαίων αγγελίας)
 * @module services/listings/public-listing-by-id.reader
 *
 * 🔑 Ζούσε αντιγραμμένη, κατά λέξη, στο `saved-listing.service.ts` και στο `stay-calendar-public.service.ts`·
 * εξήχθη όταν ήρθε ο τρίτος καταναλωτής (N.0.2). Χωριστό αρχείο από το `live-public-listings.reader.ts`, γιατί
 * εκείνο το κάνουν mock ολόκληρο τέσσερις σουίτες.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { publicListingFromDocument } from '@/lib/listings/public-listing-from-document';
import type { PublicListing } from '@/types/public-listing';

/** Η αγγελία, ή `null` αν δεν είναι δημοσιευμένη (ή το έγγραφο δεν έχει το σχήμα της προβολής). */
export async function readPublicListingById(adminDb: AdminFirestore, listingId: string): Promise<PublicListing | null> {
  const snapshot = await adminDb.collection(COLLECTIONS.PUBLIC_LISTINGS).doc(listingId).get();
  return snapshot.exists ? publicListingFromDocument(snapshot.data(), snapshot.id) : null;
}
