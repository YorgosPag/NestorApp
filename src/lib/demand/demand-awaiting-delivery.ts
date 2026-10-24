/**
 * @fileoverview **«ΧΤΙΖΟΝΤΑΙ N»** — όσες αγγελίες ταιριάζουν σε **όλα** εκτός από τον χρόνο, ως σκάλα ημερομηνιών
 * («αν περιμένεις ως Δ΄ τρίμηνο 2027, υπάρχουν 2»).
 * @related ADR-919 §12 · ADR-777 §8.99.2 (β) · lib/demand/demand-concessions.ts (`soleConcessionOf`) ·
 *   lib/demand/demand-timing-horizon.ts · lib/listings/availability-history.ts (`slipNoticeOf`)
 * @module lib/demand/demand-awaiting-delivery
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΖΕΙ ΣΤΑ `nearMissed` ΚΑΙ ΟΧΙ ΣΤΑ `rejected`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `not-available-then` είναι **μετρήσιμο**, όχι κατηγορικό (`decideVerdict`): μια αγγελία που τη σταματά **μόνο** ο
 * χρόνος γίνεται `near-miss`. Μέχρι το ADR-919 λογιζόταν `unquantified` («δεν υπάρχει "πόσο" σε ημερολόγιο»). Με τη
 * δημόσια υπόσχεση (`scheduled`) το «πόσο» **ορίζεται**: είναι η ημερομηνία της υπόσχεσης.
 *
 * 🔑 **Κανόνας «ένας άξονας, μόνος του»** — ίδιος με το `soleConcessionOf`: μετρά μόνο αγγελία με **ακριβώς ένα** εμπόδιο,
 * τον χρόνο. Αγγελία που είναι και ακριβότερη **δεν** ξεκλειδώνει με αναμονή, άρα «αν περιμένεις, υπάρχουν N» θα ήταν
 * ψευδές.
 *
 * 🔑 **Καμία δεύτερη κρίση χρόνου** (ADR-919 §3.7): διαβάζεται μόνο ό,τι σημάδεψε η μηχανή (`timingBlockers`).
 *
 * ⛔ **Ιδιωτικότητα (ADR-777 §8.99.2 #3)**: η πηγή είναι **μόνο** δημοσιευμένες αγγελίες — ποτέ έργα ή κτίρια. Χωρίς
 * k-κατώφλι, επίτηδες: οι αγγελίες είναι δημόσιες μία-μία (πρακτική Zillow / idealista: «1 resultado»)· το
 * `DEMAND_DISCLOSURE` προστατεύει **πρόσωπα που ζητούν**. Στο μηδέν η απάντηση είναι `null` — σιωπή, ποτέ «0».
 *
 * 🏆 Η αγορά μετρά νεόδμητα ως φίλτρο. Εμείς λέμε **πόσα θα ταίριαζαν**, **πότε** και **πόσα έχουν ήδη μετατεθεί**.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις. Το «σήμερα» είναι όρισμα.
 */

import { slipNoticeOf } from '@/lib/listings/availability-history';
import { compareDeliveryPromise, futureDeliveryPromiseOf } from '@/lib/listings/delivery-promise';
import type { ScheduledAvailability } from '@/types/availability-history';
import type { DemandMatch } from './demand-match-vocabulary';
import type { DemandOutcome } from './demand-matching';

/** Ένα σκαλί: «αν περιμένεις ως **αυτή** την υπόσχεση, υπάρχουν **τόσες**». Σωρευτικό. */
export interface AwaitingDeliveryStep {
  /** Η υπόσχεση του σκαλιού — η στενότερη ανάμεσα σε όσες λήγουν την ίδια ημέρα. */
  readonly promise: ScheduledAvailability;
  /** Πόσες αγγελίες ταιριάζουν αν περιμένεις ως το τέλος αυτής της υπόσχεσης — σωρευτικά. */
  readonly unlocks: number;
}

/** Ό,τι λέγεται για τις αγγελίες που «χτίζονται». */
export interface AwaitingDelivery {
  /** Πόσες ταιριάζουν σε όλα εκτός από τον χρόνο. Πάντα ≥ 1 — το μηδέν είναι `null`. */
  readonly count: number;
  /** Αύξουσα κατά τέλος υπόσχεσης. Το τελευταίο σκαλί έχει `unlocks === count`. Ποτέ κενή. */
  readonly steps: readonly AwaitingDeliveryStep[];
  /** Πόσες από αυτές έχουν ήδη μετατεθεί (`slipNoticeOf`) — σήμα αξιοπιστίας. */
  readonly slipped: number;
}

/**
 * **Το ΕΝΑ κατηγόρημα**: τη σταματά μόνο ο χρόνος. Το ρωτούν και η απογραφή των υποχωρήσεων και η απάντηση, ώστε να
 * μη διαφωνήσουν ποτέ.
 */
export function isAwaitingDelivery(match: DemandMatch): boolean {
  return match.blockers.length === 1 && match.blockers[0] === 'not-available-then';
}

/** Οι υποσχέσεις → σωρευτική σκάλα, ένα σκαλί ανά τέλος. */
function ladderOf(promises: readonly ScheduledAvailability[]): readonly AwaitingDeliveryStep[] {
  const steps: AwaitingDeliveryStep[] = [];
  [...promises].sort(compareDeliveryPromise).forEach((promise, index) => {
    const last = steps[steps.length - 1];
    if (last !== undefined && last.promise.window.end === promise.window.end) {
      steps[steps.length - 1] = { promise: last.promise, unlocks: index + 1 };
    } else {
      steps.push({ promise, unlocks: index + 1 });
    }
  });
  return steps;
}

/**
 * Η **μελλοντική** υπόσχεση μιας αγγελίας που τη σταματά μόνο ο χρόνος — αλλιώς `null`.
 *
 * Το «μελλοντική» το κρίνει το ΕΝΑ `futureDeliveryPromiseOf` (`lib/listings/delivery-promise.ts`), το ίδιο που ρωτά η
 * σύνοψη περιοχής. Μια ληγμένη υπόσχεση μπορεί να σταματήσει ζήτηση με παρελθοντικό διάστημα, αλλά δεν είναι «χτίζεται».
 * 🔑 Το ρωτούν **και** η απογραφή των υποχωρήσεων (κάδος `awaitingDelivery`) **και** η σκάλα, ώστε το άθροισμα
 * να κλείνει εκ κατασκευής.
 */
export function pendingDeliveryOf(
  { facts, match }: DemandOutcome,
  todayDate: string,
): ScheduledAvailability | null {
  return isAwaitingDelivery(match) ? futureDeliveryPromiseOf(facts.availability, todayDate) : null;
}

/**
 * **Κοντινές αγγελίες → «χτίζονται N».**
 *
 * @param nearMissed — οι ετυμηγορίες `near-miss` της `matchDemand`
 * @param todayDate — ISO `YYYY-MM-DD`· ρητή παράμετρος, ποτέ ανάγνωση ρολογιού
 */
export function awaitingDeliveryOf(
  nearMissed: readonly DemandOutcome[],
  todayDate: string,
): AwaitingDelivery | null {
  const promises: ScheduledAvailability[] = [];
  let slipped = 0;
  for (const outcome of nearMissed) {
    const promise = pendingDeliveryOf(outcome, todayDate);
    if (promise === null) continue;
    promises.push(promise);
    if (slipNoticeOf(outcome.facts.listing.availabilityTrack, promise) !== null) slipped += 1;
  }
  if (promises.length === 0) return null;
  return { count: promises.length, steps: ladderOf(promises), slipped };
}
