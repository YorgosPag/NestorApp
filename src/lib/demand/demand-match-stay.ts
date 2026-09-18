/**
 * @fileoverview **ΟΙ ΟΡΟΙ ΔΙΑΜΟΝΗΣ ΤΗΣ ΖΗΤΗΣΗΣ** — νύχτες και παρέα απέναντι στους όρους του κατόχου.
 * @related ADR-777 §8.60.19 · ADR-835 §4.5 · lib/stay/stay-availability.ts · demand-match-price.ts
 * @module lib/demand/demand-match-stay
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΔΕΝ ΕΙΝΑΙ ΔΕΥΤΕΡΟΣ ΚΡΙΤΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το «χωράει;» και το «φτάνουν οι νύχτες;» τα απαντούν **μόνο** οι `capacityVerdict` και
 * `minNightsVerdict` (`lib/stay/stay-availability.ts`) — οι ίδιοι που κρίνουν τον επισκέπτη της
 * αναζήτησης. Εδώ γίνεται **μόνο** η μετάφραση στο λεξιλόγιο της ζήτησης: ποιο εμπόδιο, ποια τάξη,
 * πόσο λείπει.
 *
 * | Κρίση του κοινού κριτή | Εμπόδιο ζήτησης | Τάξη |
 * |---|---|---|
 * | `terms-unknown` | `stay-capacity-undeclared` | απουσία (κατηγορικό) |
 * | `over-capacity` (ενήλικες + παιδιά) | `stay-over-capacity` | κατηγορικό |
 * | χωρά χωρίς βρέφη, όχι με αυτά | `stay-infants-uncertain` | αβεβαιότητα |
 * | `below-min-nights` (με το **πάνω** όριο νυχτών) | `stay-nights-below-minimum` | μετρήσιμο |
 * | `pets-not-allowed` · `over-pet-limit` (ADR-777 §8.60.21) | `stay-pets-not-allowed` · `stay-pets-over-limit` | κατηγορικό |
 * | `pets-unknown` · `pets-on-request` | `stay-pets-undeclared` · `stay-pets-on-request` | αβεβαιότητα |
 *
 * 🔑 **Οι νύχτες κρίνονται με το ΠΑΝΩ όριο του ζητούντα**: ο άνθρωπος που λέει «4–6 νύχτες» ικανοποιεί
 * ελάχιστο 6. Χωρίς πάνω όριο **κανένα** ελάχιστο δεν τον εμποδίζει — θα έμενε όσο χρειαστεί.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, καμία εξάρτηση από React/Firestore.
 */

import {
  capacityVerdict,
  minNightsVerdict,
  petsVerdict,
  type StayPetsVerdict,
} from '@/lib/stay/stay-availability';
import type { PublicListing } from '@/types/public-listing';
import {
  stayHeadcount,
  stayPartySize,
  type ShortStayDemandSeek,
  type StayParty,
} from '@/types/property-demand';
import type { DemandBlocker } from './demand-match-vocabulary';

/** Η κρίση των όρων διαμονής **μιας** εναλλακτικής. */
interface StayTermsVerdict {
  readonly blockers: readonly DemandBlocker[];
  /** Νύχτες ως το ελάχιστο του κατόχου — `null` όταν οι νύχτες δεν εμποδίζουν. */
  readonly nightsShortBy: number | null;
}

/** Καμία συνθήκη διαμονής δεν εμποδίζει. */
const STAY_TERMS_CLEAR: StayTermsVerdict = { blockers: [], nightsShortBy: null };

type ListingStay = NonNullable<PublicListing['stay']>;

/**
 * Η παρέα απέναντι στη χωρητικότητα — **πρώτα** όσοι μετρούν, **μετά** με τα βρέφη.
 *
 * ⚠️ **Η σειρά είναι συμβόλαιο**: «δεν χωρούν ούτε οι ενήλικες» είναι κλειστή υπόθεση και δεν πρέπει να
 * μαλακώσει σε «ίσως, λόγω βρέφους».
 */
function partyBlocker(stay: ListingStay, party: StayParty | null): DemandBlocker | null {
  if (party === null) return null;
  const counted = capacityVerdict(stay.maxGuests, stayHeadcount(party));
  if (counted?.kind === 'terms-unknown') return 'stay-capacity-undeclared';
  if (counted?.kind === 'over-capacity') return 'stay-over-capacity';
  if (party.infants === 0) return null;
  const everyone = capacityVerdict(stay.maxGuests, stayPartySize(party));
  return everyone?.kind === 'over-capacity' ? 'stay-infants-uncertain' : null;
}

/**
 * **Απάντηση του ΕΝΟΣ κριτή κατοικιδίων → εμπόδιο ζήτησης** (ADR-777 §8.60.21).
 *
 * 🔒 `Record` πάνω στο κλειστό σύνολο ⇒ πέμπτη απάντηση του κριτή **δεν μεταγλωττίζεται** χωρίς γραμμή
 * εδώ. Καμία δεύτερη σύγκριση `pets > maxPets` — μόνο μετάφραση λεξιλογίου.
 */
const PETS_BLOCKER: Readonly<Record<StayPetsVerdict['kind'], DemandBlocker>> = {
  'pets-unknown': 'stay-pets-undeclared',
  'pets-not-allowed': 'stay-pets-not-allowed',
  'over-pet-limit': 'stay-pets-over-limit',
  'pets-on-request': 'stay-pets-on-request',
};

/** Τα κατοικίδια της παρέας απέναντι στην πολιτική του κατόχου. Χωρίς παρέα/κατοικίδιο ⇒ τίποτα. */
function petsBlocker(stay: ListingStay, party: StayParty | null): DemandBlocker | null {
  const verdict = petsVerdict(stay.pets ?? null, party?.pets ?? null);
  return verdict === null ? null : PETS_BLOCKER[verdict.kind];
}

/**
 * **Κρίνει τους όρους διαμονής** μιας εναλλακτικής απέναντι στην αγγελία.
 *
 * ⚠️ Αγγελία **χωρίς** `stay` (δεν προσφέρει διαμονή) ⇒ καμία κρίση όρων: το `offer-kind` έχει ήδη
 * πει «όχι», και ένα «δεν δήλωσε χωρητικότητα» για ακίνητο **πώλησης** θα ήταν ψευδής λόγος.
 */
export function judgeStayTerms(listing: PublicListing, seek: ShortStayDemandSeek): StayTermsVerdict {
  const stay = listing.stay;
  if (stay === null) return STAY_TERMS_CLEAR;

  const blockers: DemandBlocker[] = [];
  const party = partyBlocker(stay, seek.party);
  if (party !== null) blockers.push(party);
  const pets = petsBlocker(stay, seek.party);
  if (pets !== null) blockers.push(pets);

  const longest = seek.nights.max;
  const nights = longest === null ? null : minNightsVerdict(stay.minNights, longest);
  if (nights !== null) blockers.push('stay-nights-below-minimum');

  return { blockers, nightsShortBy: nights === null ? null : nights.minNights - nights.asked };
}
