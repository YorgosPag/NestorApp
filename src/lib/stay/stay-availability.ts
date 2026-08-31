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

import { intervalShape, normalizeToMillisOrNull, MS_PER_DAY } from '@/lib/date-local';
import {
  occupancyConflicts,
  type Occupancy,
} from '@/lib/occupancy/occupancy-conflict';
import { earliestFreeStart } from '@/lib/occupancy/occupancy-horizon';
import type { OccupancyResource } from '@/lib/occupancy/occupancy-resource';
import type { PublicListing } from '@/types/public-listing';

import { STAY_OCCUPANCY_POLICY } from './stay-conflict';
import { freeRunsWithin } from './stay-free-runs';
import type {
  StayAvailabilityAnswer,
  StayCalendar,
  StayQuery,
  StaySaleExposure,
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
function enquiryOccupancy(listing: PublicListing, query: StayQuery): Occupancy<null> {
  const resource: OccupancyResource = {
    propertyId: listing.id,
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
  if (stay.minNights !== null && nights < stay.minNights) {
    return { kind: 'below-min-nights', minNights: stay.minNights, asked: nights };
  }

  return null;
}

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

  const terms = termsVerdict(listing.stay, query, nights);
  if (terms !== null) return terms;

  // 2️⃣ **Δηλώθηκε ημερολόγιο;** «Δεν δηλώθηκε» **δεν** είναι «ελεύθερο» (§4.6).
  if (calendar.kind === 'undeclared') return { kind: 'unknown' };

  // 3️⃣ **Ο ΚΡΙΤΗΣ, ΑΥΤΟΥΣΙΟΣ** — ο ίδιος που θα τρέξει ο διακομιστής στην έγκριση.
  const verdict = occupancyConflicts(
    enquiryOccupancy(listing, query),
    calendar.occupied,
    STAY_OCCUPANCY_POLICY,
  );

  switch (verdict.kind) {
    case 'undetermined':
      // 🔴 §6.4: *«αν το ημερολόγιο δεν διαβάστηκε, η απάντηση είναι `undetermined`,
      //    όχι ελεύθερο — γιατί ένα ελεύθερο εκεί **είναι** το overbooking»*.
      return { kind: 'unreadable' };

    case 'conflicts': {
      // 🏆 **Η ΔΙΕΞΟΔΟΣ, ΔΥΟ ΦΟΡΕΣ** — δες `StayAvailabilityAnswer` `occupied`.
      const runs = freeRunsWithin(query.checkIn, query.checkOut, calendar.occupied);
      // ⚠️ `null` από τα υποδιαστήματα = **δεν διαβάστηκαν όλα**. Ο κριτής βρήκε
      //    σύγκρουση (άρα «κρατημένο» είναι **απόδειξη**), αλλά το *«τι απομένει»*
      //    δεν το ξέρουμε — και **δεν το μαντεύουμε**: κενός πίνακας εδώ θα έλεγε
      //    «τίποτα δεν χωράει», που είναι **άλλος ισχυρισμός**.
      return {
        kind: 'occupied',
        nextFreeFrom: earliestFreeStart(verdict.conflicts),
        freeRuns: runs ?? [],
      };
    }

    case 'clear':
      // 4️⃣ **Η ΤΡΙΤΗ ΚΑΤΑΣΤΑΣΗ** (§4.7): ελεύθερο, αλλά το ακίνητο πωλείται.
      //    **Ποτέ** ισοπεδωμένο σε `free` — αυτό θα ήταν ψέμα προς τον επισκέπτη.
      if (sale !== null) {
        return { kind: 'conditional', conditionalFrom: sale.conditionalFrom };
      }
      return { kind: 'free' };
  }
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
