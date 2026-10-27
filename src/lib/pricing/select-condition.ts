/**
 * =============================================================================
 * ΕΠΙΛΟΓΗ ΣΥΝΘΗΚΗΣ — ο ειδικότερος νικά, με ίχνος (ADR-923 §5.11 · SAP access sequence)
 * =============================================================================
 *
 * Σειρά: **σκληρά φίλτρα** (ταιριάζει το εύρος/κοινό; ισχύει την ημερομηνία;) → **καταρράκτης
 * ειδικότητας** (λεξικογραφική σύγκριση του `specificity`, μεγαλύτερο νικά).
 *
 * 🔑 **Ισοπαλία ≠ «ο πρώτος»** (το Odoo διαλέγει με τη σειρά της λίστας — εδώ απορρίπτεται): δύο
 * εξίσου ειδικές έγκυρες συνθήκες είναι **ασάφεια** και επιστρέφονται ως `ambiguous`. Την
 * αρνείται ήδη η αποθήκευση· αν παρ' όλα αυτά εμφανιστεί, ο καταναλωτής το **βλέπει**.
 *
 * 🔑 **Ίχνος** (SAP «pricing analysis»): κάθε υποψήφιος με την ετυμηγορία του — το «γιατί
 * αυτή η τιμή» απαντιέται από δεδομένα, όχι από εικασία.
 *
 * Γενικός ως προς το είδος της συνθήκης: τον χρησιμοποιεί ο κατάλογος και, στη Φάση 3γ, οι
 * Συμβάσεις-Πλαίσιο. **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 * @module lib/pricing/select-condition
 */

import { validityAt, type ValidityVerdict, type ValidityWindow } from './validity';

export interface SelectionCandidate<T, R extends string> {
  readonly id: string;
  readonly item: T;
  readonly validity: ValidityWindow;
  /** Γιατί **δεν** ταιριάζει (εύρος, κοινό…) — `null` αν ταιριάζει. */
  readonly mismatch: R | null;
  /** Λεξικογραφικά: το πρώτο στοιχείο μετρά πρώτο, μεγαλύτερο = ειδικότερο. */
  readonly specificity: readonly number[];
}

export type SelectionVerdict<R extends string> =
  | 'selected'
  | 'tied'
  | 'outranked'
  | Exclude<ValidityVerdict, 'valid'>
  | R;

export interface SelectionTraceEntry<R extends string> {
  readonly id: string;
  readonly verdict: SelectionVerdict<R>;
}

export type Selection<T, R extends string> =
  | { readonly kind: 'none'; readonly trace: readonly SelectionTraceEntry<R>[] }
  | { readonly kind: 'selected'; readonly winner: T; readonly winnerId: string; readonly trace: readonly SelectionTraceEntry<R>[] }
  | { readonly kind: 'ambiguous'; readonly tiedIds: readonly string[]; readonly trace: readonly SelectionTraceEntry<R>[] };

/** Λεξικογραφική σύγκριση· το λείπον στοιχείο μετρά ως 0. */
export function compareSpecificity(a: readonly number[], b: readonly number[]): number {
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index++) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function hardFilterVerdict<T, R extends string>(
  candidate: SelectionCandidate<T, R>,
  atMs: number,
): SelectionVerdict<R> | null {
  if (candidate.mismatch !== null) return candidate.mismatch;
  const validity = validityAt(candidate.validity, atMs);
  return validity === 'valid' ? null : validity;
}

/** Επιλέγει τον ειδικότερο έγκυρο υποψήφιο τη στιγμή `atMs`. */
export function selectMostSpecific<T, R extends string>(
  candidates: readonly SelectionCandidate<T, R>[],
  atMs: number,
): Selection<T, R> {
  const verdicts = new Map<string, SelectionVerdict<R>>();
  const eligible: SelectionCandidate<T, R>[] = [];
  for (const candidate of candidates) {
    const rejected = hardFilterVerdict(candidate, atMs);
    if (rejected === null) eligible.push(candidate);
    else verdicts.set(candidate.id, rejected);
  }

  let best: SelectionCandidate<T, R>[] = [];
  for (const candidate of eligible) {
    const order = best.length === 0 ? 1 : compareSpecificity(candidate.specificity, best[0].specificity);
    if (order > 0) best = [candidate];
    else if (order === 0) best.push(candidate);
  }
  const bestIds = new Set(best.map((candidate) => candidate.id));
  const topVerdict: SelectionVerdict<R> = best.length > 1 ? 'tied' : 'selected';
  for (const candidate of eligible) verdicts.set(candidate.id, bestIds.has(candidate.id) ? topVerdict : 'outranked');

  const trace = candidates.map((candidate) => ({ id: candidate.id, verdict: verdicts.get(candidate.id) ?? 'outranked' }));
  if (best.length === 0) return { kind: 'none', trace };
  if (best.length > 1) return { kind: 'ambiguous', tiedIds: [...bestIds], trace };
  return { kind: 'selected', winner: best[0].item, winnerId: best[0].id, trace };
}
