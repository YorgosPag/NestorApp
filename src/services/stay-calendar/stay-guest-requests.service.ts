/**
 * @fileoverview **ΤΑ ΑΙΤΗΜΑΤΑ ΜΟΥ ΓΙΑ ΑΥΤΗ ΤΗΝ ΑΓΓΕΛΙΑ** — ό,τι βλέπει ο επισκέπτης για τον εαυτό του.
 * @related ADR-835 §23.5 · lib/stay/stay-guest-request-view.ts · app/api/public-listings/[listingId]/stay-request
 * @module services/stay-calendar/stay-guest-requests.service
 *
 * 🔑 Το ««τα ταξίδια μου» σε όλες τις αγγελίες» είναι Στάδιο Δ2· εδώ είναι το **ελάχιστο** που χρειάζεται η
 * σελίδα της αγγελίας για να πει «το αίτημά σου είναι σε αναμονή ως 14:00 — απόσυρση».
 */

import 'server-only';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { stayBookingFromDocument } from '@/lib/stay/stay-calendar-from-document';
import {
  stayGuestRequestViewOf,
  type StayGuestRequests,
  type StayGuestRequestView,
} from '@/lib/stay/stay-guest-request-view';

/** Ανώτατα αιτήματα ενός ανθρώπου για **μία** αγγελία — πέρα από αυτό δεν είναι επισκέπτης, είναι θόρυβος. */
const MAX_REQUESTS_PER_LISTING = 50;

/**
 * **Τα αιτήματα του `uid` για την αγγελία `listingId`**, η πιο πρόσφατη άφιξη πρώτη.
 * 🔴 Χαλασμένο έγγραφο ⇒ `unreadable`, ποτέ «δεν έχεις αίτημα» — αυτό θα έκανε τον άνθρωπο να ζητήσει
 * δεύτερη φορά κάτι που ήδη κρατά.
 */
export async function readGuestStayRequests(
  adminDb: AdminFirestore,
  listingId: string,
  uid: string,
  instant: string,
): Promise<StayGuestRequests> {
  // tenant-scope-exempt: ο άξονας του `stay_bookings` είναι ο συντάκτης της αγγελίας· εδώ ρωτά ο
  // **επισκέπτης** για τον **εαυτό** του — το `guestUserId == uid` ΕΙΝΑΙ το σύνορο, και είναι το ίδιο
  // με τον κανόνα ανάγνωσης του Firestore (ADR-835 §23). Από τον διακομιστή φεύγει μόνο η προβολή.
  const snapshot = await adminDb
    .collection(COLLECTIONS.STAY_BOOKINGS)
    .where('propertyId', '==', listingId)
    .where('guestUserId', '==', uid)
    .limit(MAX_REQUESTS_PER_LISTING)
    .get();
  const requests: StayGuestRequestView[] = [];
  for (const doc of snapshot.docs) {
    const booking = stayBookingFromDocument(doc.data(), doc.id);
    if (booking === null) return { kind: 'unreadable' };
    requests.push(stayGuestRequestViewOf(booking, instant));
  }
  requests.sort((a, b) => (a.checkIn === b.checkIn ? a.id.localeCompare(b.id) : a.checkIn < b.checkIn ? 1 : -1));
  return { kind: 'readable', requests };
}
