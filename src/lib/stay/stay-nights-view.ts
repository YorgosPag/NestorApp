/**
 * @fileoverview **ΤΟ ΔΗΜΟΣΙΟ ΗΜΕΡΟΛΟΓΙΟ** — ανά νύχτα: ελεύθερη/κλειστή/υπό αίρεση + άφιξη/αναχώρηση.
 * @related ADR-835 §4.5 (αναθεώρηση 2026-09-17) · §20.3 #1 · §21 · lib/stay/stay-rules.ts ·
 *   lib/stay/stay-availability.ts
 * @module lib/stay/stay-nights-view
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ ΣΧΗΜΑ ΤΗΣ ΑΓΟΡΑΣ, ΧΩΡΙΣ ΠΟΙΟΣ Η ΓΙΑΤΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το ημερολόγιο της σελίδας αγγελίας της Airbnb παίρνει ανά μέρα `available ·
 * availableForCheckin · availableForCheckout · minNights · maxNights`. Εδώ το ίδιο, με
 * **τρεις** καταστάσεις αντί για δύο (§4.7: `conditional`). ⛔ Καμία ταυτότητα, καμία
 * σημείωση, καμία διάκριση «κράτηση / block / προετοιμασία» — ο επισκέπτης βλέπει
 * **κλειστό**, όχι **γιατί**.
 *
 * 🔴 **ΙΣΟΔΥΝΑΜΙΑ ΜΕ ΤΗ ΜΗΧΑΝΗ.** Ο πελάτης επιλέγει άφιξη→αναχώρηση πάνω σε αυτή την
 * προβολή με το {@link stayableInView}. Αν αυτό έλεγε «ναι» εκεί που η μηχανή λέει «όχι»,
 * ο επισκέπτης θα έβλεπε διαθέσιμο κάτι που απορρίπτεται. Γι' αυτό και οι δύο χτίζονται
 * από τις **ίδιες** κρίσεις (`stay-rules.ts`), και άγκυρα ελέγχει **κάθε** ζεύγος.
 *
 * **Layering**: καθαρές συναρτήσεις, μηδέν I/O, μηδέν ρολόι.
 */

import { addDaysToDateKey, daysBetweenDateKeys } from '@/lib/calendar/date-key';
import { intervalShape } from '@/lib/date-local';
import type { Occupancy } from '@/lib/occupancy/occupancy-conflict';
import type { PublicListing } from '@/types/public-listing';
import { STAY_RULE_MAX_NIGHTS, type StayRulesInput } from '@/types/stay-rules';

import type { StayCalendar, StayChannelTrust, StaySaleExposure } from './stay-availability-vocabulary';
import {
  arrivalAllowed,
  bookableUntil,
  departureAllowed,
  earliestCheckIn,
  maxNightsForArrival,
  minNightsForArrival,
} from './stay-rules';

// =============================================================================
// 1. ΤΟ ΣΧΗΜΑ
// =============================================================================

/**
 * Η κατάσταση μιας νύχτας για τον ανώνυμο επισκέπτη.
 *
 * 🔴 **`unsynced` (Στάδιο Γ, §22) ΔΕΝ είναι «κλειστή» ούτε «ελεύθερη»**: ένα κανάλι
 * σώπασε πάνω από το όριο εμπιστοσύνης, άρα **δεν ξέρουμε** αν πουλήθηκε. Η αγορά, στην
 * ίδια θέση, εξακολουθεί να γράφει «ελεύθερη» — και αυτό **είναι** το overbooking (§6.4).
 */
export type StayPublicNightState = 'free' | 'closed' | 'conditional' | 'unsynced';

/** Μία νύχτα του δημόσιου ημερολογίου. */
export interface StayPublicNight {
  /** `YYYY-MM-DD` — η νύχτα που ξεκινά αυτή τη μέρα. */
  readonly date: string;
  readonly state: StayPublicNightState;
  /** Μπορεί να **ξεκινήσει** διαμονή εδώ που πράγματι χωράει; */
  readonly checkInAllowed: boolean;
  /** Μπορεί να **τελειώσει** διαμονή σήμερα (η χθεσινή νύχτα ανοιχτή + κανόνας αναχώρησης); */
  readonly checkOutAllowed: boolean;
  /** Ελάχιστες νύχτες για άφιξη σήμερα — ήδη χαλαρωμένες σε ορφανό κενό. */
  readonly minNights: number | null;
  readonly maxNights: number | null;
}

/** Η απάντηση για ένα εύρος ημερών. */
export type StayPublicNights =
  | { readonly kind: 'undeclared' }
  | { readonly kind: 'unreadable' }
  | { readonly kind: 'declared'; readonly nights: readonly StayPublicNight[] };

// =============================================================================
// 2. ΚΛΕΙΣΤΕΣ ΝΥΧΤΕΣ
// =============================================================================

/** Οι κλειστές νύχτες στο `[from, to)` — ή `null` αν κάποια κατάληψη δεν διαβάζεται. */
function closedNightsWithin<TSource>(
  occupied: readonly Occupancy<TSource>[],
  from: string,
  to: string,
): Set<string> | null {
  const closed = new Set<string>();
  for (const occupancy of occupied) {
    const end = occupancy.expiresAt ?? to;
    const shape = intervalShape(occupancy.startsAt, end);
    // 🔴 Ό,τι ο κριτής δεν μπορεί να κρίνει (άκυρο ή ανάποδο) μολύνει όλη την προβολή.
    if (shape === 'unreadable' || shape === 'reversed') return null;
    const start = occupancy.startsAt > from ? occupancy.startsAt : from;
    const stop = end < to ? end : to;
    for (let day: string | null = start; day !== null && day < stop; day = addDaysToDateKey(day, 1)) {
      closed.add(day);
    }
  }
  return closed;
}

/** Η κατάσταση μιας νύχτας, από τις κλειστές + ειδοποίηση + παράθυρο + αίρεση. */
function nightStateOf(
  date: string,
  closed: ReadonlySet<string>,
  bounds: { readonly earliest: string; readonly until: string | null },
  sale: StaySaleExposure | null,
): StayPublicNightState {
  if (date < bounds.earliest || (bounds.until !== null && date >= bounds.until)) return 'closed';
  if (closed.has(date)) return 'closed';
  if (sale !== null && (sale.conditionalFrom === null || date >= sale.conditionalFrom)) {
    return 'conditional';
  }
  return 'free';
}

/** Μπορεί να επιλεγεί αυτή η νύχτα; **Μία** διατύπωση για τα δύο άκρα της επιλογής. */
function selectable(state: StayPublicNightState): boolean {
  return state === 'free' || state === 'conditional';
}

/**
 * **Ό,τι θα λέγαμε «ελεύθερο» γίνεται `unsynced` όταν ένα κανάλι σώπασε** — και ό,τι
 * ξέρουμε κλειστό **μένει** κλειστό (Στάδιο Γ, §22).
 *
 * 🔑 Ίδια απόφαση με το `syncedAnswer` της μηχανής, από την άλλη άκρη: **μόνο η
 * υπόσχεση** υποβαθμίζεται, ποτέ η γνώση.
 */
function syncedState(state: StayPublicNightState, channels: StayChannelTrust): StayPublicNightState {
  return channels === 'stale' && selectable(state) ? 'unsynced' : state;
}

// =============================================================================
// 3. ΤΟ ΚΑΤΗΓΟΡΗΜΑ — κοινό για διακομιστή (εφικτότητα) και πελάτη (επιλογή)
// =============================================================================

/** Οι νύχτες ως χάρτης κατά ημερομηνία. */
type NightIndex = ReadonlyMap<string, StayPublicNight>;

function indexOf(nights: readonly StayPublicNight[]): NightIndex {
  return new Map(nights.map((night) => [night.date, night]));
}

/**
 * **Χωράει `[checkIn, checkOut)` πάνω σε αυτή την προβολή;** — χωρίς να ρωτήσει την
 * εφικτότητα της άφιξης (αυτή **παράγεται** από εδώ). Κοινό σώμα των δύο δρόμων.
 */
function fitsWithin(index: NightIndex, checkIn: string, checkOut: string): boolean {
  const first = index.get(checkIn);
  const last = index.get(checkOut);
  const nights = daysBetweenDateKeys(checkIn, checkOut);
  if (first === undefined || last === undefined || nights === null || nights < 1) return false;
  if (!last.checkOutAllowed) return false;
  if (first.minNights !== null && nights < first.minNights) return false;
  if (first.maxNights !== null && nights > first.maxNights) return false;
  for (let day: string | null = checkIn; day !== null && day < checkOut; day = addDaysToDateKey(day, 1)) {
    if (index.get(day)?.state !== 'free' && index.get(day)?.state !== 'conditional') return false;
  }
  return true;
}

/**
 * **Επιτρέπεται η επιλογή άφιξη→αναχώρηση;** — το κατηγόρημα του πελάτη.
 *
 * ⚠️ Ένδειξη, όχι άδεια: η έγκριση κρίνεται **πάντα** ξανά στον διακομιστή, σε φρέσκα δεδομένα.
 */
export function stayableInView(
  nights: readonly StayPublicNight[],
  checkIn: string,
  checkOut: string,
): boolean {
  const index = indexOf(nights);
  return index.get(checkIn)?.checkInAllowed === true && fitsWithin(index, checkIn, checkOut);
}

/**
 * Υπάρχει **τουλάχιστον μία** αναχώρηση που χωράει από αυτή την άφιξη;
 *
 * Ένα πέρασμα: σταματά στην πρώτη κλειστή νύχτα (καμία μεταγενέστερη αναχώρηση δεν χωρά),
 * και κρίνει ό,τι το {@link fitsWithin} πέρα από τις νύχτες — αναχώρηση και διάρκεια.
 */
function someStayFits(index: NightIndex, checkIn: string, lastDate: string): boolean {
  const first = index.get(checkIn);
  if (first === undefined) return false;
  let nights = 0;
  for (let day: string | null = checkIn; day !== null && day < lastDate; day = addDaysToDateKey(day, 1)) {
    if (index.get(day)?.state === 'closed') return false;
    nights += 1;
    const out = addDaysToDateKey(day, 1);
    const last = out === null ? undefined : index.get(out);
    if (first.maxNights !== null && nights > first.maxNights) return false;
    const longEnough = first.minNights === null || nights >= first.minNights;
    if (longEnough && last?.checkOutAllowed === true) return true;
  }
  return false;
}

// =============================================================================
// 4. Η ΚΛΗΣΗ
// =============================================================================

/** Οι νύχτες χωρίς τη σημαία εφικτής άφιξης (βήμα 1 από 2). */
function draftNights<TSource>(
  listing: PublicListing,
  calendar: {
    readonly occupied: readonly Occupancy<TSource>[];
    readonly rules: StayRulesInput;
    readonly channels: StayChannelTrust;
  },
  sale: StaySaleExposure | null,
  from: string,
  to: string,
): StayPublicNight[] | null {
  const input = calendar.rules;
  const closed = closedNightsWithin(calendar.occupied, from, to);
  if (closed === null) return null;
  const bounds = { earliest: earliestCheckIn(input), until: bookableUntil(input) };
  const base = listing.stay?.minNights ?? null;
  const nights: StayPublicNight[] = [];
  let previous: StayPublicNightState = 'closed';
  for (let date: string | null = from; date !== null && date < to; date = addDaysToDateKey(date, 1)) {
    const state = syncedState(nightStateOf(date, closed, bounds, sale), calendar.channels);
    nights.push({
      date,
      state,
      // 🔑 Μόνο `free`/`conditional` δέχονται άφιξη/αναχώρηση: μια `unsynced` νύχτα δεν
      //    επιλέγεται — αλλιώς η οθόνη θα υποσχόταν ό,τι η μηχανή αρνείται (§21.5).
      checkInAllowed: selectable(state) && arrivalAllowed(input, date),
      checkOutAllowed: selectable(previous) && departureAllowed(input, date),
      minNights: minNightsForArrival(input, base, date, calendar.occupied),
      maxNights: maxNightsForArrival(input, date),
    });
    previous = state;
  }
  return nights;
}

/**
 * **Το δημόσιο ημερολόγιο για `[from, to)`.**
 *
 * 🔑 Υπολογίζεται σε **εκτεταμένο** εύρος (έως {@link STAY_RULE_MAX_NIGHTS} νύχτες μετά),
 * ώστε η εφικτότητα μιας άφιξης στο τέλος του μήνα να κρίνεται με τις νύχτες του επόμενου.
 *
 * @param from — `YYYY-MM-DD`, πρώτη νύχτα. @param to — πρώτη νύχτα **εκτός**.
 */
export function publicNightsOf<TSource>(
  listing: PublicListing,
  calendar: StayCalendar<TSource>,
  sale: StaySaleExposure | null,
  from: string,
  to: string,
): StayPublicNights {
  if (calendar.kind !== 'declared') return { kind: calendar.kind };
  const extendedTo = addDaysToDateKey(to, STAY_RULE_MAX_NIGHTS + 1);
  if (extendedTo === null || intervalShape(from, to) !== 'proper') return { kind: 'unreadable' };

  // Μία μέρα **πριν**: η αναχώρηση της πρώτης μέρας κρίνεται από τη χθεσινή νύχτα.
  const dayBefore = addDaysToDateKey(from, -1) ?? from;
  const draft = draftNights(listing, calendar, sale, dayBefore, extendedTo);
  if (draft === null) return { kind: 'unreadable' };

  const index = indexOf(draft);
  const lastDate = draft[draft.length - 1]?.date ?? from;
  const nights = draft
    .filter((night) => night.date >= from && night.date < to)
    .map((night) => ({
      ...night,
      checkInAllowed: night.checkInAllowed && someStayFits(index, night.date, lastDate),
    }));
  return { kind: 'declared', nights };
}
