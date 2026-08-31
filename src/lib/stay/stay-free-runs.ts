/**
 * @fileoverview **ΤΙ ΑΠΟ ΑΥΤΟ ΠΟΥ ΖΗΤΗΣΕΣ ΧΩΡΑΕΙ;** — τα ελεύθερα υποδιαστήματα.
 * @related ADR-835 §4.6 · lib/occupancy/occupancy-conflict.ts · lib/date-local.ts ·
 *   lib/stay/stay-availability.ts
 * @module lib/stay/stay-free-runs
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΕΔΩ ΞΕΠΕΡΝΑΜΕ ΤΗΝ ΑΓΟΡΑ — ΚΑΙ ΤΟ ΚΕΝΟ ΕΙΝΑΙ **ΜΕΤΡΗΜΕΝΟ**, ΟΧΙ ΡΗΤΟΡΙΚΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η καταγεγραμμένη συμπεριφορά κάθε πλατφόρμας κρατήσεων:
 *
 *   «*If a guest searches specific dates and the calendar shows those dates as
 *   unavailable, the property **will not appear** for that search, no matter how
 *   optimized the rest of the listing is… the search algorithm **completely hides**
 *   unavailable listings rather than suggesting nearby dates or showing **partially
 *   available** properties.*»
 *
 * Δηλαδή ένα κατάλυμα που είναι ελεύθερο **5 από τις 7** νύχτες σου **εξαφανίζεται**,
 * και δεν μαθαίνεις ποτέ ότι υπήρχε.
 *
 * 🔴 **Το πλησιέστερο που έχει φτάσει η αγορά είναι τα *split stays* της Airbnb — και
 * απαντούν σε ΑΛΛΟ ερώτημα.** Ζευγαρώνουν **δύο διαφορετικά** καταλύματα για να
 * καλύψουν τις μέρες σου, ενεργοποιούνται **μόνο** σε διαμονές ≥ 1 εβδομάδας και
 * **μόνο** όταν τα αποτελέσματα είναι < 300. Κανένα δεν λέει ποτέ:
 *
 *   > *«αυτό εδώ χωράει **10–12/08** και **15–17/08** — κρατημένο μόνο 12–14/08»*
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΚΑΙ ΓΙΑΤΙ ΤΟ ΕΡΓΟ ΕΧΕΙ ΗΔΗ ΤΗ ΛΕΞΗ ΓΙ' ΑΥΤΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Δεν είναι νέα ιδέα — είναι το **υπάρχον** ιδίωμα `isMeasurableBlocker`
 * (`lib/demand/demand-match-vocabulary.ts`): *«ένα **μετρήσιμο** εμπόδιο απαντά “πόσο
 * λείπει” — άρα ο χρήστης μπορεί να κάνει κάτι»*. Η πλήρης κατάληψη είναι
 * **κατηγορικό** εμπόδιο· η **μερική** είναι μετρήσιμο, και η αγορά τα ισοπεδώνει και
 * τα δύο σε εξαφάνιση.
 *
 * ⛔ **ΔΕΝ είναι δεύτερος κριτής, και η διάκριση είναι αυστηρή.** Το ερώτημα
 * *«συγκρούεται;»* το απαντά **μόνο** ο `occupancyConflicts`. Αυτό εδώ απαντά το
 * **επόμενο** ερώτημα — *«αφού συγκρούεται, τι απομένει;»* — και το απαντά πάνω στις
 * **ίδιες** καταλήψεις που ο κριτής ήδη έκρινε. Ποτέ δεν αποφασίζει σύγκρουση.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, μηδέν ρολόι.
 */

import { intervalShape, normalizeToMillisOrNull, utcDateOf, MS_PER_DAY } from '@/lib/date-local';

import type { Occupancy } from '@/lib/occupancy/occupancy-conflict';

// =============================================================================
// 1. ΤΟ ΑΠΟΤΕΛΕΣΜΑ
// =============================================================================

/**
 * **Ένα συνεχές ελεύθερο κομμάτι** μέσα στο ζητούμενο παράθυρο.
 *
 * ⚠️ **Ημι-ανοιχτό `[from, to)`, όπως ΚΑΘΕ διάστημα του μοντέλου** (ADR-835 §16 ·
 * ADR-832 §5.2): το `to` είναι η μέρα **αναχώρησης**, δεν είναι νύχτα. Γι' αυτό το
 * {@link StayNightRun.nights} υπάρχει ως **πεδίο** και δεν αφήνεται στον καταναλωτή:
 * η πιθανότερη χειρόγραφη παραλλαγή (`to - from + 1`) μετρά **μία νύχτα παραπάνω**
 * σε κάθε κάρτα — και θα ήταν λάθος που ο επισκέπτης πληρώνει.
 */
export interface StayNightRun {
  /** ISO `YYYY-MM-DD` — η **άφιξη**. Ανήκει στο διάστημα. */
  readonly from: string;
  /** ISO `YYYY-MM-DD` — η **αναχώρηση**. **ΔΕΝ** ανήκει στο διάστημα. */
  readonly to: string;
  /** Πλήθος **νυχτών** = ημέρες μεταξύ `from` και `to`. Πάντα ≥ 1. */
  readonly nights: number;
}

/** Εσωτερικό: διάστημα σε χιλιοστά, ήδη κομμένο στο παράθυρο. */
interface MsRange {
  readonly from: number;
  readonly to: number;
}

// =============================================================================
// 2. Η ΑΝΑΓΝΩΣΗ — fail-closed
// =============================================================================

/**
 * Μία κατάληψη → διάστημα σε χιλιοστά, **κομμένο** στο παράθυρο.
 *
 * @returns το κομμένο διάστημα · `null` αν **δεν αγγίζει** το παράθυρο (ή είναι
 *   **κενό**, που δεν καταλαμβάνει τίποτα — Ε-10) · `'unreadable'` αν δεν κρίνεται.
 *
 * 🔴 **Το `'unreadable'` ΔΕΝ γίνεται `null`, και είναι όλο το μάθημα του N.12.** Ένα
 * χαλασμένο διάστημα σιωπηλά αγνοημένο σημαίνει *«αυτές οι νύχτες είναι ελεύθερες»* —
 * δηλαδή **ακριβώς** το overbooking που το §6.4 απαγορεύει ονομαστικά.
 *
 * ⚠️ **Η ανοιχτή διάρκεια (`expiresAt: null`) ΕΙΝΑΙ αναγνώσιμη**: σημαίνει «ως το
 * τέλος του χρόνου», άρα κόβεται στο τέλος του παραθύρου. Δεν είναι βλάβη.
 */
function clipToWindow<TSource>(
  occupancy: Occupancy<TSource>,
  window: MsRange,
): MsRange | null | 'unreadable' {
  const open = occupancy.expiresAt === null;
  // 🔑 **Ο ΕΝΑΣ αναγνώστης σχήματος**, ποτέ χειρόγραφη σύγκριση: το `empty`, το
  //    `reversed` και το `unreadable` τα ξεχωρίζει **αυτός**, με ονόματα (Ε-10).
  if (!open) {
    const shape = intervalShape(occupancy.startsAt, occupancy.expiresAt);
    if (shape === 'unreadable' || shape === 'reversed') return 'unreadable';
    // ⚠️ **Κενό διάστημα δεν τέμνει τίποτα** (`∅ ∩ X = ∅`) — άρα δεν αφαιρεί καμία
    //    νύχτα. Ίδια απάντηση με τον `intervalsOverlap`, ώστε τα δύο να μη διαφωνούν.
    if (shape === 'empty') return null;
  }

  const from = normalizeToMillisOrNull(occupancy.startsAt);
  if (from === null) return 'unreadable';
  const to = open ? window.to : normalizeToMillisOrNull(occupancy.expiresAt);
  if (to === null) return 'unreadable';

  const clippedFrom = Math.max(from, window.from);
  const clippedTo = Math.min(to, window.to);
  // Δεν αγγίζει το παράθυρο — **γνωστό** «όχι», όχι βλάβη.
  if (clippedFrom >= clippedTo) return null;
  return { from: clippedFrom, to: clippedTo };
}

/** Ενώνει επικαλυπτόμενα **και εφαπτόμενα** διαστήματα σε μέγιστα συνεχή. */
function mergeRanges(ranges: readonly MsRange[]): MsRange[] {
  const sorted = [...ranges].sort((a, b) => a.from - b.from);
  const merged: MsRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    // ⚠️ `>=` και όχι `>`: δύο **διαδοχικές** κρατήσεις (η μία τελειώνει όταν αρχίζει
    //    η άλλη) είναι **ένα** συνεχές κατειλημμένο κομμάτι. Με `>` θα γεννιόταν
    //    ελεύθερο διάστημα **μηδενικού** μήκους ανάμεσά τους — δηλαδή θα προτείναμε
    //    στον επισκέπτη διαμονή **μηδέν νυχτών**.
    if (last !== undefined && range.from <= last.to) {
      if (range.to > last.to) merged[merged.length - 1] = { from: last.from, to: range.to };
      continue;
    }
    merged.push(range);
  }
  return merged;
}

/** Τα κενά ανάμεσα στα κατειλημμένα, μέσα στο παράθυρο, ως ημερολογιακά κομμάτια. */
function gapsWithin(window: MsRange, occupied: readonly MsRange[]): StayNightRun[] {
  const runs: StayNightRun[] = [];
  let cursor = window.from;

  for (const range of occupied) {
    if (range.from > cursor) pushRun(runs, cursor, range.from);
    cursor = Math.max(cursor, range.to);
  }
  if (cursor < window.to) pushRun(runs, cursor, window.to);

  return runs;
}

/** Προσθέτει κομμάτι, **μόνο** αν είναι πραγματικές νύχτες και διαβάζεται. */
function pushRun(runs: StayNightRun[], fromMs: number, toMs: number): void {
  const nights = Math.round((toMs - fromMs) / MS_PER_DAY);
  if (nights < 1) return;
  const from = utcDateOf(fromMs);
  const to = utcDateOf(toMs);
  if (from === null || to === null) return;
  runs.push({ from, to, nights });
}

// =============================================================================
// 3. Η ΜΙΑ ΚΛΗΣΗ
// =============================================================================

/**
 * **Τι απομένει ελεύθερο μέσα στο ζητούμενο;**
 *
 * @param checkIn · `checkOut` — το παράθυρο του επισκέπτη, ημι-ανοιχτό.
 * @param occupied — οι καταλήψεις που ο **κριτής** έκρινε ότι εμποδίζουν. Δεν
 *   φιλτράρονται εδώ: το φιλτράρισμα ανήκει στον καλούντα (ίδιο δόγμα με τον κριτή).
 *
 * @returns τα μέγιστα συνεχή ελεύθερα κομμάτια, σε **χρονολογική** σειρά · κενός
 *   πίνακας όταν **τίποτα** δεν χωράει · **`null`** όταν κάτι δεν διαβάστηκε.
 *
 * 🔴 **Το `null` ΔΕΝ είναι «κανένα ελεύθερο», και η σύγχυση των δύο είναι το
 * overbooking.** Κενός πίνακας = *«κοίταξα, δεν χωράει τίποτα»*. `null` = *«δεν
 * μπόρεσα να κοιτάξω»*. Ένας τύπος `StayNightRun[]` και για τα δύο θα έκανε το
 * **άγνωστο** να μοιάζει με **γνωστό** (N.12) — και ο καταναλωτής θα έδειχνε
 * «κρατημένο» εκεί που η αλήθεια είναι «δεν ξέρω».
 *
 * ⚠️ **Ανάποδο ή κενό ΖΗΤΟΥΜΕΝΟ ⇒ `null`**, όχι κενός πίνακας: ο επισκέπτης που
 * έγραψε «από 17/08 ως 10/08» δεν έμαθε ότι *«δεν υπάρχει τίποτα»* — έγραψε ερώτηση
 * που **δεν είναι ερώτηση**, και η οθόνη οφείλει να του πει ποια από τις δύο.
 */
export function freeRunsWithin<TSource>(
  checkIn: string,
  checkOut: string,
  occupied: readonly Occupancy<TSource>[],
): readonly StayNightRun[] | null {
  if (intervalShape(checkIn, checkOut) !== 'proper') return null;

  const from = normalizeToMillisOrNull(checkIn);
  const to = normalizeToMillisOrNull(checkOut);
  if (from === null || to === null) return null;
  const window: MsRange = { from, to };

  const clipped: MsRange[] = [];
  for (const occupancy of occupied) {
    const range = clipToWindow(occupancy, window);
    // 🔴 **Μία βλάβη μολύνει ΟΛΗ την απάντηση** — fail-closed. Δεν μπορούμε να πούμε
    //    «τα υπόλοιπα είναι ελεύθερα» όταν μία κατάληψη μένει αδιάβαστη: το κομμάτι
    //    που θα προτείναμε μπορεί να είναι **ακριβώς** αυτό που εκείνη κρατά.
    if (range === 'unreadable') return null;
    if (range !== null) clipped.push(range);
  }

  return gapsWithin(window, mergeRanges(clipped));
}
