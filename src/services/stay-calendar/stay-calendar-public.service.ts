/**
 * @fileoverview **Η ΔΗΜΟΣΙΑ ΔΙΑΘΕΣΙΜΟΤΗΤΑ** — ό,τι βλέπει ο ανώνυμος επισκέπτης, υπολογισμένο ΣΤΟΝ ΔΙΑΚΟΜΙΣΤΗ.
 * @related ADR-835 §4.5 (αναθεώρηση 2026-09-17) · §18.1 · §21 · lib/stay/stay-calendar-of.ts ·
 *   lib/stay/stay-nights-view.ts · lib/stay/stay-availability.ts · lib/stay/stay-nightly-quote.ts
 * @module services/stay-calendar/stay-calendar-public.service
 *
 * 🔑 **Δρόμος Β του §18.1, όπως η Airbnb**: οι κρατήσεις είναι ιδιωτικές, άρα ο κριτής
 * τρέχει εδώ και φεύγει μόνο η **απάντηση** — ποτέ εγγραφές, ονόματα, σημειώσεις, ή το
 * «γιατί» μιας κλειστής νύχτας.
 *
 * ⚠️ **Ένδειξη, ποτέ άδεια.** Η έγκριση μιας κράτησης κρίνεται πάντα ξανά μέσα στη
 * συναλλαγή (Στάδιο Δ). Γι' αυτό η απάντηση μπορεί να κρυφτεί για λίγα δευτερόλεπτα.
 */

import 'server-only';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { publicListingFromDocument } from '@/lib/listings/public-listing-from-document';
import { saleExposureOf, stayAvailabilityFor } from '@/lib/stay/stay-availability';
import type { StayQuery } from '@/lib/stay/stay-availability-vocabulary';
import { stayCalendarOf, stayClockAt, stayDayRulesOf } from '@/lib/stay/stay-calendar-of';
import { monthWindow } from '@/lib/stay/stay-calendar-month';
import { stayQuoteOf } from '@/lib/stay/stay-nightly-quote';
import type { PublicStayAnswer } from '@/lib/stay/stay-public-request';
import { publicNightsOf, type StayPublicNights } from '@/lib/stay/stay-nights-view';
import type { PublicListing } from '@/types/public-listing';

import { readStayCalendar } from './stay-calendar-read.service';

/** Πόσες αγγελίες διαβάζονται παράλληλα σε μία απάντηση αναζήτησης. */
const PARALLEL_READS = 8;

/** Μια αγγελία με ό,τι χρειάζεται η μηχανή — ή τίποτα, αν δεν είναι κατάλυμα. */
interface PublicStay {
  readonly listing: PublicListing;
  readonly reading: Awaited<ReturnType<typeof readStayCalendar>>;
}

async function readPublicListing(adminDb: AdminFirestore, listingId: string): Promise<PublicListing | null> {
  const snap = await adminDb.collection(COLLECTIONS.PUBLIC_LISTINGS).doc(listingId).get();
  return snap.exists ? publicListingFromDocument(snap.data(), snap.id) : null;
}

/** Τι βρέθηκε για μια ταυτότητα αγγελίας. */
type PublicStayRead =
  | { readonly kind: 'stay'; readonly stay: PublicStay }
  | { readonly kind: 'not-a-stay' }
  /** Δεν υπάρχει (αποσύρθηκε) ή δεν διαβάζεται — ο πελάτης την έχει, εμείς όχι. */
  | { readonly kind: 'missing' };

async function readPublicStay(adminDb: AdminFirestore, listingId: string): Promise<PublicStayRead> {
  const listing = await readPublicListing(adminDb, listingId);
  if (listing === null) return { kind: 'missing' };
  if (listing.stay === null || !listing.offerKinds.includes('leaseShort')) return { kind: 'not-a-stay' };
  return { kind: 'stay', stay: { listing, reading: await readStayCalendar(adminDb, listing.id, null) } };
}

/**
 * **Το δημόσιο ημερολόγιο ανά νύχτα**, για `months` μήνες από τον `fromMonth`.
 * @returns `null` = δεν υπάρχει ή δεν είναι κατάλυμα (ίδια απάντηση, επίτηδες).
 */
export async function readPublicStayNights(
  adminDb: AdminFirestore,
  listingId: string,
  fromMonth: string,
  months: number,
  now: Date,
): Promise<StayPublicNights | null> {
  const read = await readPublicStay(adminDb, listingId);
  if (read.kind !== 'stay') return null;
  const { stay } = read;
  const calendar = stayCalendarOf(stay.reading, stayClockAt(now));
  const window = monthWindow(fromMonth, months);
  return publicNightsOf(stay.listing, calendar, saleExposureOf(stay.listing), window.from, window.to);
}

async function answerOne(adminDb: AdminFirestore, listingId: string, query: StayQuery, now: Date): Promise<PublicStayAnswer> {
  const read = await readPublicStay(adminDb, listingId);
  // 🔴 Αγγελία που ο πελάτης έχει κι εμείς δεν βρίσκουμε ⇒ **δικό μας** χρέος, ποτέ «δεν είναι κατάλυμα».
  if (read.kind === 'missing') return { answer: { kind: 'unreadable' }, quote: null };
  if (read.kind === 'not-a-stay') return { answer: { kind: 'not-a-stay' }, quote: null };
  const { stay } = read;
  const calendar = stayCalendarOf(stay.reading, stayClockAt(now));
  const answer = stayAvailabilityFor(stay.listing, query, calendar, saleExposureOf(stay.listing));
  // Οι τιμές ανά ημέρα ισχύουν και σε αδήλωτο ημερολόγιο· σε αδιάβαστο, δεν τιμολογούμε.
  const days = stay.reading.kind === 'readable' ? stayDayRulesOf(stay.reading.months) : null;
  const quote = days === null ? null : stayQuoteOf(stay.listing, days, query.checkIn, query.checkOut);
  return { answer, quote };
}

/**
 * **Απαντήσεις για πολλές αγγελίες** — η αναζήτηση παίρνει **πραγματικό** ημερολόγιο (§18.1).
 *
 * 🔴 Αγγελία που **δεν** βρίσκεται πια δεν εξαφανίζεται από την απάντηση: παίρνει `unreadable`
 * ώστε η λογιστική του πελάτη να κλείνει στο ίδιο σύνολο.
 */
export async function readPublicStayAnswers(
  adminDb: AdminFirestore,
  listingIds: readonly string[],
  query: StayQuery,
  now: Date,
): Promise<Readonly<Record<string, PublicStayAnswer>>> {
  const answers: Record<string, PublicStayAnswer> = {};
  for (let start = 0; start < listingIds.length; start += PARALLEL_READS) {
    const chunk = listingIds.slice(start, start + PARALLEL_READS);
    const results = await Promise.all(chunk.map((id) => answerOne(adminDb, id, query, now)));
    chunk.forEach((id, index) => {
      answers[id] = results[index];
    });
  }
  return answers;
}
