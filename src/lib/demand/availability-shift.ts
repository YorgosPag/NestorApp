/**
 * @fileoverview **ΠΟΙΟΣ ΧΑΝΕΙ Ή ΚΕΡΔΙΖΕΙ ΤΑΙΡΙ ΕΠΕΙΔΗ ΑΛΛΑΞΕ Η ΔΗΜΟΣΙΑ ΥΠΟΣΧΕΣΗ** — καθαρό.
 * @related ADR-919 §10 · ADR-777 §8.99.4 (Δ3) · lib/demand/demand-matching.ts · lib/listings/availability-history.ts
 * @module lib/demand/availability-shift
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΡΩΤΑΜΕ ΤΗ ΜΗΧΑΝΗ ΔΥΟ ΦΟΡΕΣ, ΔΕΝ ΞΑΝΑΚΡΙΝΟΥΜΕ (ADR-919 §3.7)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το «ταιριάζει τότε;» ζει **μόνο** στο `timingBlockers`. Μια δεύτερη κρίση εδώ («το τέλος πέρασε το `toDate`;»)
 * θα διαφωνούσε με τη μηχανή στο πρώτο όριο: στο «Τώρα», στο `unknown`, στο Δ4. Γι' αυτό τα γεγονότα της αγγελίας
 * κρίνονται **ολόκληρα** (κατηγορία, τιμή, θέση, χρόνος) δύο φορές, με την παλιά και τη νέα δημόσια τιμή, και η
 * διαφορά είναι η απάντηση. Ό,τι άλλο εμπόδιζε το ταίρι το εμποδίζει και στις δύο ερωτήσεις, άρα δεν χρεώνεται
 * ποτέ στη μετάθεση.
 *
 * ⚠️ **Μόνο οι φρέσκιες αλλαγές** (`isAvailabilityChangeFresh`), και ποτέ το `refined`: η εξειδίκευση κρατά το
 * ίδιο τέλος, άρα η μηχανή απαντά δομικά το ίδιο. Δεν της κάνουμε ερώτηση που ξέρουμε την απάντηση.
 *
 * **Layering**: καθαρό — καμία εξάρτηση από Firestore/δίκτυο/ρολόι.
 */

import { isAvailabilityChangeFresh } from '@/lib/listings/availability-history';
import type { AvailabilityChange } from '@/types/availability-history';
import type { PropertyDemand } from '@/types/property-demand';

import type { AvailabilityShiftDirection } from './demand-announcement';
import { matchDemandAgainstListing, type DemandOutcome, type ListingMatchFacts } from './demand-matching';

/** Τα ταιριάσματα που **άλλαξαν** για μία ζήτηση, προς μία κατεύθυνση. Ίδιο σχήμα με το `DemandMatches`. */
export interface DemandShifts {
  readonly demand: PropertyDemand;
  readonly matched: readonly DemandOutcome[];
}

/** Οι αλλαγές ενός περάσματος, χωρισμένες ανά κατεύθυνση. */
export type AvailabilityShifts = Readonly<Record<AvailabilityShiftDirection, readonly DemandShifts[]>>;

/** Μια αγγελία με φρέσκια, κρίσιμη αλλαγή: τα γεγονότα της **τώρα** και **πριν**. */
interface ChangedFacts {
  readonly now: ListingMatchFacts;
  readonly before: ListingMatchFacts;
}

/** Η αλλαγή που αξίζει ερώτηση στη μηχανή, ή `null`. */
export function judgeableChangeOf(change: AvailabilityChange | null, nowMs: number): AvailabilityChange | null {
  if (change === null || change.kind === 'refined') return null;
  return isAvailabilityChangeFresh(change, nowMs) ? change : null;
}

function changedFactsOf(candidates: readonly ListingMatchFacts[], nowMs: number): readonly ChangedFacts[] {
  return candidates.flatMap((facts) => {
    const change = judgeableChangeOf(facts.listing.availabilityTrack?.lastChange ?? null, nowMs);
    return change === null ? [] : [{ now: facts, before: { ...facts, availability: change.from } }];
  });
}

/** Η διαφορά μίας ζήτησης πάνω σε όλες τις αλλαγμένες αγγελίες. */
function shiftsOfDemand(
  demand: PropertyDemand,
  changed: readonly ChangedFacts[],
  todayDate: string,
): Record<AvailabilityShiftDirection, DemandOutcome[]> {
  const shifts: Record<AvailabilityShiftDirection, DemandOutcome[]> = { lost: [], gained: [] };
  for (const { now, before } of changed) {
    const matchNow = matchDemandAgainstListing(demand, now, todayDate);
    const matchBefore = matchDemandAgainstListing(demand, before, todayDate);
    const fitsNow = matchNow.verdict === 'match';
    if (fitsNow === (matchBefore.verdict === 'match')) continue;
    // Ο «χαμένος» κρατά την ετυμηγορία του ΠΡΙΝ: εκείνο είναι το «ως τι» που του είχαμε πει.
    if (fitsNow) shifts.gained.push({ facts: now, match: matchNow });
    else shifts.lost.push({ facts: now, match: matchBefore });
  }
  return shifts;
}

/**
 * **Ποιες ζητήσεις χάνουν ή κερδίζουν ποιες αγγελίες** εξαιτίας της τελευταίας αλλαγής της δημόσιας υπόσχεσης.
 *
 * @param candidates τα γεγονότα των ζωντανών αγγελιών (`listingFactsFrom`), όπως τα βλέπει και το ταίριασμα.
 * @param todayDate η **ίδια** «σήμερα» για τις δύο ερωτήσεις: αλλιώς η διαφορά θα χρέωνε στη μετάθεση το ρολόι.
 */
export function availabilityShiftsOf(
  demands: readonly PropertyDemand[],
  candidates: readonly ListingMatchFacts[],
  todayDate: string,
  nowMs: number,
): AvailabilityShifts {
  const changed = changedFactsOf(candidates, nowMs);
  const result: Record<AvailabilityShiftDirection, DemandShifts[]> = { lost: [], gained: [] };
  if (changed.length === 0) return result;

  for (const demand of demands) {
    const shifts = shiftsOfDemand(demand, changed, todayDate);
    if (shifts.lost.length > 0) result.lost.push({ demand, matched: shifts.lost });
    if (shifts.gained.length > 0) result.gained.push({ demand, matched: shifts.gained });
  }
  return result;
}
