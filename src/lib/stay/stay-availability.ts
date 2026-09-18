/**
 * @fileoverview **ΕΙΝΑΙ ΕΛΕΥΘΕΡΟ ΓΙΑ ΕΣΕΝΑ;** — ο **ΤΡΙΤΟΣ** καταναλωτής του κριτή.
 * @related ADR-835 §4.5 · §4.6 · §4.7 · §6.2 · lib/occupancy/occupancy-conflict.ts ·
 *   lib/stay/stay-conflict.ts · lib/stay/stay-free-runs.ts ·
 *   lib/mandate/mandate-occupancy-notice.ts
 * @module lib/stay/stay-availability
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ ΚΑΤΟΠΤΡΟ ΤΟΥ `mandate-occupancy-notice.ts`, ΕΠΙΤΗΔΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Εντολή (ADR-832) | Διαμονή (ADR-835 Φ3) |
 * |---|---|
 * | `occupancyNotice(...)` | {@link stayAvailabilityFor} |
 * | `MandateOccupancyNotice` | `StayAvailabilityAnswer` |
 * | `availableFrom` | `nextFreeFrom` **+ `freeRuns`** |
 * | ρωτά ο **ιδιοκτήτης** πριν προτείνει όρους | ρωτά ο **επισκέπτης** πριν ζητήσει διαμονή |
 *
 * Το ίδιο σχήμα, τρίτη φορά: *«ο άνθρωπος **μαθαίνει το εμπόδιο πριν** το συναντήσει,
 * και μαθαίνει **τι μπορεί να κάνει**»*. Το πρότυπο είναι τα **worksets του Revit**
 * (ιδιοκτησία στοιχείου **πριν** το πειράξεις), όχι τα MLS.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΤΙ ΔΕΝ ΕΙΝΑΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ — ΚΑΙ ΤΟ ΔΕΥΤΕΡΟ ΕΙΝΑΙ ΤΟ ΠΙΟ ΕΠΙΚΙΝΔΥΝΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ⛔ **Δεν είναι δεύτερος κριτής.** Ο κανόνας ζει στο `lib/occupancy/` και καλείται
 * **αυτούσιος**. Καμία σύγκριση διαστημάτων δεν γράφεται εδώ: το ερώτημα
 * *«τέμνονται;»* το απαντά ο `occupancyConflicts`, και **μόνο** αυτός.
 *
 * ⛔ **ΔΕΝ ΕΙΝΑΙ ΦΡΟΥΡΟΣ, ΚΑΙ ΔΕΝ ΑΠΟΤΡΕΠΕΙ OVERBOOKING.** Είναι **πληροφορία** για
 * την οθόνη. Το `Κ1` του §12 λύνεται **μόνο** μέσα στη συναλλαγή της έγκρισης, πάνω σε
 * **φρέσκα** δεδομένα (Φ5) — ακριβώς όπως το έμαθε το ADR-832 §7.2(α). Ετυμηγορία
 * υπολογισμένη για την οθόνη είναι **ένδειξη**, ποτέ άδεια.
 *
 * ⛔ **Δεν διαβάζει Firestore και δεν κρατά ρολόι.** Το ημερολόγιο φτάνει ως **ρητή
 * είσοδος** ({@link StayCalendar}) — δες εκεί για το γιατί, και για την απόφαση του
 * §3.2 σε μία παράγραφο.
 *
 * ⛔ **Δεν κρίνει διάρκεια κατά τον νόμο.** Το όριο των **59 ημερών** (Ν.5073/2023)
 * μπαίνει στο **ΟΝΟΜΑ** της διάθεσης, ποτέ στην πράξη (§4.9). Το `minNights` εδώ είναι
 * **εμπορικός όρος του κατόχου**, άλλο πράγμα.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, μηδέν ρολόι.
 */

import { addDaysToDateKey } from '@/lib/calendar/date-key';
import { intervalShape, normalizeToMillisOrNull, MS_PER_DAY } from '@/lib/date-local';
import {
  occupancyConflicts,
  type Occupancy,
} from '@/lib/occupancy/occupancy-conflict';
import { earliestFreeStart } from '@/lib/occupancy/occupancy-horizon';
import type { OccupancyResource } from '@/lib/occupancy/occupancy-resource';
import type { PublicListing } from '@/types/public-listing';

import type { StayRulesInput } from '@/types/stay-rules';

import { STAY_OCCUPANCY_POLICY } from './stay-conflict';
import { freeRunsWithin } from './stay-free-runs';
import {
  arrivalAllowed,
  bookableUntil,
  departureAllowed,
  earliestCheckIn,
  maxNightsForArrival,
  minNightsForArrival,
  nearestDates,
} from './stay-rules';
import {
  isStayable,
  type StayAvailabilityAnswer,
  type StayCalendar,
  type StayChannelTrust,
  type StayQuery,
  type StaySaleExposure,
} from './stay-availability-vocabulary';

// =============================================================================
// 1. ΤΟ ΕΡΩΤΗΜΑ ΩΣ ΚΑΤΑΛΗΨΗ — η μετάφραση που ζητά ο κριτής
// =============================================================================

/**
 * **Ο κάτοχος του ερωτήματος.** Σταθερά, και **ποτέ** ταυτότητα ανθρώπου.
 *
 * 🔑 **Δεν χρησιμοποιείται από τον κριτή, και είναι απόδειξη όχι ισχυρισμός**: η
 * πολιτική των κρατήσεων είναι `sameHolder: 'conflicts'` ({@link STAY_OCCUPANCY_POLICY}),
 * δηλαδή ο κλάδος που διαβάζει `holderId` **δεν εκτελείται ποτέ**. Μια πραγματική
 * ταυτότητα εδώ θα ήταν **ταυτότητα επισκέπτη σε καθαρή μηχανή** — και το `PublicListing`
 * είναι το αρχείο που δηλώνει ότι *«καμία ταυτότητα πελάτη»* δεν ταξιδεύει.
 *
 * ⚠️ Αν κάποτε η πολιτική γίνει `'replaces'`, αυτή η σταθερά γίνεται **σιωπηλά
 * σημαντική**. Άγκυρα το φυλάει: ερώτημα και υπάρχουσα κράτηση **συγκρούονται** ακόμη
 * κι όταν μοιράζονται κάτοχο.
 */
const ANONYMOUS_ENQUIRER = 'stay-availability-enquiry';

/**
 * **Το ερώτημα του επισκέπτη ως υποψήφια κατάληψη** — η μετάφραση προς τον κριτή.
 *
 * 🔴 **`occupancyId: null`, και είναι σωστό**: το ερώτημα **δεν είναι εγγραφή**. Ο
 * κριτής παραλείπει τον έλεγχο ταυτότητας όταν λείπει — *«δύο `null` σημαίνουν “δεν
 * ξέρω ποιες είναι”, όχι “είναι η ίδια”»* (N.12). Μια ψεύτικη ταυτότητα εδώ θα
 * κινδύνευε να συμπέσει με υπαρκτή κράτηση και να την **αγνοήσει**.
 *
 * ⚠️ **`spaceId: null` = ΟΛΟΚΛΗΡΟ το ακίνητο** (§4.12). Ο ανώνυμος επισκέπτης ρωτά για
 * το κατάλυμα ως σύνολο· η τομή συνόλων του `sharedResources` κάνει ώστε **και** η
 * κράτηση ενός δωματίου να το εμποδίζει — που είναι το σωστό: αν το δωμάτιο Α είναι
 * πιασμένο, το «ολόκληρο» **δεν** είναι ελεύθερο.
 */
export function stayEnquiryOccupancy(propertyId: string, query: StayQuery): Occupancy<null> {
  const resource: OccupancyResource = {
    propertyId,
    spaceId: null,
    kind: 'leaseShort',
  };
  return {
    occupancyId: null,
    holderId: ANONYMOUS_ENQUIRER,
    // 🔴 **`exclusive`, πάντα** — δύο άνθρωποι δεν κοιμούνται στο ίδιο δωμάτιο επειδή
    //    το σύστημα το βρήκε συμβατό (ίδιο σκεπτικό με το `stayOccupancyOf`).
    mode: 'exclusive',
    resources: [resource],
    startsAt: query.checkIn,
    expiresAt: query.checkOut,
    source: null,
  };
}

// =============================================================================
// 2. ΟΙ ΟΡΟΙ — φθηνοί, σταθεροί, και κρίνονται ΠΡΩΤΟΙ
// =============================================================================

/** Πόσες νύχτες ζητά το ερώτημα· `null` αν το διάστημα δεν διαβάζεται. */
function nightsOf(query: StayQuery): number | null {
  if (intervalShape(query.checkIn, query.checkOut) !== 'proper') return null;
  const from = normalizeToMillisOrNull(query.checkIn);
  const to = normalizeToMillisOrNull(query.checkOut);
  if (from === null || to === null) return null;
  return Math.round((to - from) / MS_PER_DAY);
}

/**
 * Οι **σταθεροί όροι** του κατόχου, κριμένοι πριν από το ημερολόγιο.
 *
 * @returns η απάντηση αν κάποιος όρος αποφασίζει· `null` αν όλοι περνούν.
 *
 * ⚠️ **Η σειρά ΕΙΝΑΙ συμβόλαιο** (ίδιο ιδίωμα με το `coverageStateOf`): η άγνωστη
 * χωρητικότητα κρίνεται **πριν** την υπέρβαση, γιατί «δεν ξέρω» δεν μπορεί να παράγει
 * «δεν χωράει». Και **και τα δύο** κρίνονται πριν το ημερολόγιο, γιατί ισχύουν **ό,τι
 * κι αν λέει** εκείνο — και το *«χωράει μόνο 2»* είναι χρησιμότερο για τον άνθρωπο
 * από το *«δεν ξέρω το ημερολόγιο»*.
 */
function termsVerdict(
  stay: NonNullable<PublicListing['stay']>,
  query: StayQuery,
  nights: number,
  judgeMinNights: boolean,
): StayAvailabilityAnswer | null {
  if (query.guests !== null) {
    // 🔴 «Δεν δήλωσε» **δεν** γίνεται «χωράει» ούτε «δεν χωράει» (N.12).
    if (stay.maxGuests === null) return { kind: 'terms-unknown' };
    if (query.guests > stay.maxGuests) {
      return { kind: 'over-capacity', maxGuests: stay.maxGuests, asked: query.guests };
    }
  }

  // ⚠️ `minNights === null` = **δεν δήλωσε ελάχιστο**, άρα δεν εμποδίζει τίποτα. Ένα
  //    `?? 1` θα υποσχόταν εκ μέρους του κατόχου κάτι που δεν είπε.
  //    Με δηλωμένο ημερολόγιο το ελάχιστο κρίνεται **μετά** τον κριτή (ανά άφιξη + κενό).
  if (judgeMinNights && stay.minNights !== null && nights < stay.minNights) {
    return { kind: 'below-min-nights', minNights: stay.minNights, asked: nights };
  }

  return null;
}

/**
 * **Οι κανόνες ΧΡΟΝΟΥ** (Στάδιο Β) — κρίνονται πριν τον κριτή, γιατί ισχύουν ό,τι κι αν
 * είναι κρατημένο: ειδοποίηση · παράθυρο · άφιξη · αναχώρηση.
 */
function timeRulesVerdict(input: StayRulesInput, query: StayQuery): StayAvailabilityAnswer | null {
  const earliest = earliestCheckIn(input);
  if (query.checkIn < earliest) return { kind: 'advance-notice', earliestCheckIn: earliest };

  const until = bookableUntil(input);
  if (until !== null && query.checkOut > until) {
    return { kind: 'outside-window', bookableUntil: until };
  }

  if (!arrivalAllowed(input, query.checkIn)) {
    const near = nearestDates(query.checkIn, (day) => arrivalAllowed(input, day), earliest);
    return { kind: 'arrival-not-allowed', nearestBefore: near.before, nearestAfter: near.after };
  }

  if (!departureAllowed(input, query.checkOut)) {
    // Η αναχώρηση είναι πάντα **μετά** την άφιξη — το `floor` είναι η επόμενη μέρα της.
    const floor = addDaysToDateKey(query.checkIn, 1) ?? query.checkOut;
    const near = nearestDates(query.checkOut, (day) => departureAllowed(input, day), floor);
    return { kind: 'departure-not-allowed', nearestBefore: near.before, nearestAfter: near.after };
  }

  return null;
}

/**
 * **Οι κανόνες ΔΙΑΡΚΕΙΑΣ** — μετά τον κριτή, γιατί το ελάχιστο εξαρτάται από το κενό
 * γύρω από την άφιξη (ορφανό κενό, πρότυπο PriceLabs).
 */
function lengthRulesVerdict<TSource>(
  listing: PublicListing,
  query: StayQuery,
  nights: number,
  calendar: DeclaredStayCalendar<TSource>,
): StayAvailabilityAnswer | null {
  const max = maxNightsForArrival(calendar.rules, query.checkIn);
  if (max !== null && nights > max) {
    return { kind: 'above-max-nights', maxNights: max, asked: nights };
  }

  const base = listing.stay?.minNights ?? null;
  const min = minNightsForArrival(calendar.rules, base, query.checkIn, calendar.occupied);
  if (min !== null && nights < min) {
    return { kind: 'below-min-nights', minNights: min, asked: nights };
  }
  return null;
}

/** Ο δηλωμένος κλάδος του ημερολογίου. */
type DeclaredStayCalendar<TSource> = Extract<StayCalendar<TSource>, { kind: 'declared' }>;

// =============================================================================
// 3. Η ΜΙΑ ΚΛΗΣΗ
// =============================================================================

/**
 * **Τι απαντά αυτή η αγγελία στις ημερομηνίες του επισκέπτη;**
 *
 * @param listing — η δημόσια προβολή, αυτούσια. Καθαρός τύπος, μηδέν I/O.
 * @param query — τι ρώτησε ο άνθρωπος. Δες {@link StayQuery}.
 * @param calendar — **τι ξέρουμε** για το ημερολόγιο. Δες {@link StayCalendar} — εκεί
 *   ζει η απόφαση του §3.2 σε μία παράγραφο.
 * @param sale — η αίρεση πώλησης (§4.7), ή `null`. Παράγεται από
 *   {@link saleExposureOf}, ή δίνεται από τον διακομιστή με **ημερομηνία παράδοσης**.
 *
 * 🔑 **Εννέα απαντήσεις, καμία σιωπή.** Ό,τι κι αν συμβεί, η αγγελία παίρνει **όνομα**
 * και μπαίνει σε **έναν** κάδο της λογιστικής. Η αγορά, στην ίδια θέση, **εξαφανίζει**.
 */
export function stayAvailabilityFor<TSource>(
  listing: PublicListing,
  query: StayQuery,
  calendar: StayCalendar<TSource>,
  sale: StaySaleExposure | null,
): StayAvailabilityAnswer {
  // 1️⃣ **Είναι κατάλυμα;** Πρώτο απ' όλα: η ερώτηση δεν αφορά ό,τι δεν νοικιάζεται
  //    βραχυχρόνια — και αυτό **δεν είναι αποτυχία** (δες το λεξιλόγιο).
  if (!listing.offerKinds.includes('leaseShort') || listing.stay === null) {
    return { kind: 'not-a-stay' };
  }

  const nights = nightsOf(query);
  // 🔴 **Χαλασμένο ΕΡΩΤΗΜΑ ⇒ `unreadable`, fail-closed.** Ο κανονικός δρόμος δεν το
  //    παράγει (ο κωδικοποιητής της διεύθυνσης δέχεται **μόνο** `proper` διαστήματα),
  //    αλλά ένας φρουρός που δεν μπορεί να πυροδοτήσει είναι φρουρός που κάποτε θα
  //    χρειαστεί: ένα σιωπηλό `free` εδώ **είναι** το overbooking (§6.4).
  if (nights === null) return { kind: 'unreadable' };

  // Χωρίς δηλωμένο ημερολόγιο ο όρος `minNights` κρίνεται εδώ· με δηλωμένο, μετά τον κριτή.
  const terms = termsVerdict(listing.stay, query, nights, calendar.kind !== 'declared');
  if (terms !== null) return terms;

  // 2️⃣ **Δηλώθηκε ημερολόγιο;** «Δεν δηλώθηκε» **δεν** είναι «ελεύθερο» (§4.6).
  if (calendar.kind === 'undeclared') return { kind: 'unknown' };
  // 🔴 Δηλωμένο αλλά αδιάβαστο ⇒ **δικό μας** χρέος, ποτέ «ελεύθερο» (§6.4).
  if (calendar.kind === 'unreadable') return { kind: 'unreadable' };

  // 3️⃣ **Οι κανόνες χρόνου** (Στάδιο Β) — ισχύουν ό,τι κι αν είναι κρατημένο.
  const time = timeRulesVerdict(calendar.rules, query);
  if (time !== null) return time;

  return syncedAnswer(calendarVerdict(listing, query, nights, calendar, sale), calendar.channels);
}

/**
 * 7️⃣ **ΜΙΛΟΥΝ ΤΑ ΚΑΝΑΛΙΑ;** (Στάδιο Γ, §22) — το **τελευταίο** βήμα, και είναι
 * απόφαση για τη σειρά:
 *
 * 🔑 **Μόνο η ΥΠΟΣΧΕΣΗ υποβαθμίζεται.** Ένα `occupied` παραμένει `occupied`: το ξέρουμε
 * από **δικά μας** δεδομένα και κουβαλά τη διέξοδό του (*«ελεύθερο από 14/08»*). Αν
 * γυρνούσαμε `unsynced` **πριν** τον κριτή, θα πετούσαμε πληροφορία που έχουμε — και ο
 * επισκέπτης θα ξαναρωτούσε για νύχτες που ξέρουμε σίγουρα πιασμένες.
 *
 * 🔴 Ό,τι είναι `stayable` (`free` · `conditional`) είναι **υπόσχεση προς τον
 * επισκέπτη**, και υπόσχεση για νύχτες που ένα σιωπηλό κανάλι μπορεί να έχει πουλήσει
 * **είναι** το overbooking (§6.4).
 */
function syncedAnswer(answer: StayAvailabilityAnswer, channels: StayChannelTrust): StayAvailabilityAnswer {
  return channels === 'stale' && isStayable(answer.kind) ? { kind: 'unsynced' } : answer;
}

/** 4️⃣–6️⃣ Ο κριτής, οι κανόνες διάρκειας, και η τρίτη κατάσταση. */
function calendarVerdict<TSource>(
  listing: PublicListing,
  query: StayQuery,
  nights: number,
  calendar: DeclaredStayCalendar<TSource>,
  sale: StaySaleExposure | null,
): StayAvailabilityAnswer {
  // 4️⃣ **Ο ΚΡΙΤΗΣ, ΑΥΤΟΥΣΙΟΣ** — ο ίδιος που θα τρέξει ο διακομιστής στην έγκριση.
  const verdict = occupancyConflicts(
    stayEnquiryOccupancy(listing.id, query),
    calendar.occupied,
    STAY_OCCUPANCY_POLICY,
  );

  if (verdict.kind === 'undetermined') {
    // 🔴 §6.4: *«αν το ημερολόγιο δεν διαβάστηκε, η απάντηση είναι `undetermined`,
    //    όχι ελεύθερο — γιατί ένα ελεύθερο εκεί **είναι** το overbooking»*.
    return { kind: 'unreadable' };
  }

  if (verdict.kind === 'conflicts') {
    // 🏆 **ΣΕ ΑΝΑΜΟΝΗ** (Στάδιο Δ, §23.5): αν **όλες** οι συγκρούσεις είναι ζωντανά αιτήματα, οι
    //    νύχτες ελευθερώνονται μόνες τους — λέμε **ως πότε**, με την αργότερη προθεσμία.
    const held = heldUntilOfAll(verdict.conflicts.map((conflict) => conflict.with.source), calendar.heldUntilOf);
    if (held !== null) return { kind: 'held', until: held };
    // 🏆 **Η ΔΙΕΞΟΔΟΣ, ΔΥΟ ΦΟΡΕΣ** — δες `StayAvailabilityAnswer` `occupied`.
    const runs = freeRunsWithin(query.checkIn, query.checkOut, calendar.occupied);
    // ⚠️ `null` από τα υποδιαστήματα = **δεν διαβάστηκαν όλα**. «Κρατημένο» είναι
    //    **απόδειξη**, αλλά το *«τι απομένει»* δεν το μαντεύουμε.
    return {
      kind: 'occupied',
      nextFreeFrom: earliestFreeStart(verdict.conflicts),
      freeRuns: runs ?? [],
    };
  }

  // 5️⃣ **Διάρκεια** — ανά άφιξη, με χαλάρωση ορφανού κενού.
  const length = lengthRulesVerdict(listing, query, nights, calendar);
  if (length !== null) return length;

  // 6️⃣ **Η ΤΡΙΤΗ ΚΑΤΑΣΤΑΣΗ** (§4.7): ελεύθερο, αλλά το ακίνητο πωλείται.
  //    **Ποτέ** ισοπεδωμένο σε `free` — αυτό θα ήταν ψέμα προς τον επισκέπτη.
  if (sale !== null) return { kind: 'conditional', conditionalFrom: sale.conditionalFrom };
  return { kind: 'free' };
}

/**
 * **Η αργότερη προθεσμία, αν ΟΛΕΣ οι πηγές είναι ζωντανά αιτήματα** — αλλιώς `null`.
 *
 * ⚠️ Μία σκληρή κατάληψη ⇒ `null`: η απάντηση «σε αναμονή ως 14:00» θα ήταν ψέμα, αφού στις 14:00
 * οι νύχτες **δεν** ελευθερώνονται. Κενό σύνολο ⇒ `null` (δεν υπάρχει σύγκρουση για να ονομαστεί).
 */
export function heldUntilOfAll<TSource>(
  sources: readonly TSource[],
  heldUntilOf: (source: TSource) => string | null,
): string | null {
  let latest: string | null = null;
  for (const source of sources) {
    const until = heldUntilOf(source);
    if (until === null) return null;
    if (latest === null || Date.parse(until) > Date.parse(latest)) latest = until;
  }
  return latest;
}

/**
 * **Πωλείται το ακίνητο ενώ δέχεται κρατήσεις;** — η αίρεση από το **ίδιο** το σχήμα.
 *
 * 🔑 **Κανένα νέο πεδίο** (§4.7): το `offerKinds` περιέχει **ήδη** `sell` δίπλα στο
 * `leaseShort`, άρα η συνύπαρξη είναι **δομικά** γνωστή. *«Μια πληροφορία που κανείς
 * δεν σχεδίασε να ζητήσει, **υπάρχει**»* — και είναι ακριβώς ο λόγος που η Α20
 * επέμεινε στον άξονα που δεν χάνει τίποτα.
 *
 * ⚠️ **`conditionalFrom: null` εδώ σημαίνει «δεν ξέρουμε ημερομηνία παράδοσης»**, όχι
 * «καμία αίρεση». Η ημερομηνία θα έρθει από τη **δεσμευμένη πώληση** όταν το μοντέλο
 * της υπάρξει· ως τότε η αίρεση καλύπτει **όλο** το παράθυρο, που είναι η ειλικρινής
 * και η ασφαλής ανάγνωση.
 *
 * ⛔ **ΠΟΤΕ φράχτης** (§4.7): η συνύπαρξη **δεν** εμποδίζει κράτηση. Η μηχανή
 * **βλέπει και ονομάζει** — δεν απαγορεύει.
 */
export function saleExposureOf(listing: PublicListing): StaySaleExposure | null {
  if (!listing.offerKinds.includes('sell')) return null;
  if (!listing.offerKinds.includes('leaseShort')) return null;
  return { conditionalFrom: null };
}
