/**
 * @fileoverview ADR-915 §27 — **«Ανάθεση σε γνωστό»**: ποιους ξέρει ήδη το γραφείο για ένα έγγραφο, με σειρά και **γιατί**.
 * @related issuance-assignment.ts (τα γεγονότα · `qualifiesFor`) · issuance-rows.ts (ο καλών)
 * @module lib/document-validity/issuance-candidates
 *
 * Εξήχθη από το `issuance-assignment.ts` (§28): ο μειωτής μεγάλωσε με τους συνδέσμους, και η κατάταξη είναι άλλη ευθύνη —
 * διαβάζει το **ιστορικό** των αναθέσεων, δεν κρίνει μεταβάσεις.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 */

import type { DocumentKind } from '@/config/document-validity/document-validity';
import { qualifiesFor, type IssuanceAssignmentRecord, type IssuanceCredential } from './issuance-assignment';

/** Μία ανάθεση του γραφείου στο παρελθόν ή τώρα — ό,τι χρειάζεται η κατάταξη. */
export interface IssuanceRosterEntry {
  readonly propertyId: string;
  readonly documentKind: DocumentKind;
  readonly record: IssuanceAssignmentRecord;
}

export type CandidateReason =
  | { readonly kind: 'same-property'; readonly documentKind: DocumentKind }
  | { readonly kind: 'previously-assigned'; readonly count: number; readonly lastAt: string };

export interface IssuanceCandidate {
  readonly contactId: string;
  readonly reasons: readonly CandidateReason[];
  /** Το προσόν που **ήδη** δήλωσε το γραφείο και επαρκεί για αυτό το είδος — `null` ⇒ θέλει δήλωση. */
  readonly credential: IssuanceCredential | null;
}

/** Πόσοι υποψήφιοι φτάνουν στην οθόνη — οι υπόλοιποι βρίσκονται με την αναζήτηση επαφής. */
export const ISSUANCE_CANDIDATES_SHOWN = 5;

/** Μόνο όσα ο ιδιοκτήτης **ενέκρινε** μετρούν ως «ξανά» — μια απορριφθείσα πρόταση δεν είναι εμπειρία. */
function wasApproved(record: IssuanceAssignmentRecord): boolean {
  return record.decision?.outcome === 'approved';
}

interface CandidateTally {
  sameProperty: DocumentKind | null;
  count: number;
  lastAt: string;
  credential: IssuanceCredential | null;
}

function tallyOf(entries: readonly IssuanceRosterEntry[], kind: DocumentKind, propertyId: string): Map<string, CandidateTally> {
  const tally = new Map<string, CandidateTally>();
  for (const { record, documentKind, propertyId: entryProperty } of entries) {
    const id = record.professionalContactId;
    const fits = qualifiesFor(kind, record.credential.qualification) ? record.credential : null;
    const entry = tally.get(id) ?? { sameProperty: null, count: 0, lastAt: '', credential: null };
    if (entryProperty === propertyId && documentKind !== kind) entry.sameProperty = documentKind;
    if (documentKind === kind) {
      entry.count += 1;
      if (record.proposedAt > entry.lastAt) entry.lastAt = record.proposedAt;
    }
    entry.credential = entry.credential ?? fits;
    tally.set(id, entry);
  }
  return tally;
}

function reasonsOf(entry: CandidateTally): CandidateReason[] {
  const reasons: CandidateReason[] = [];
  if (entry.sameProperty !== null) reasons.push({ kind: 'same-property', documentKind: entry.sameProperty });
  if (entry.count > 0) reasons.push({ kind: 'previously-assigned', count: entry.count, lastAt: entry.lastAt });
  return reasons;
}

/**
 * **Ποιους ξέρει ήδη το γραφείο** για αυτό το έγγραφο, με τη σειρά που θα τους πρότεινε ένας έμπειρος συνεργάτης:
 * 1. όποιος βγάζει το **άλλο** έγγραφο του **ίδιου** ακινήτου (ένας μηχανικός για ΠΕΑ + ταυτότητα — §18.5)·
 * 2. όσοι έχουν ξαναπάρει **αυτό** το είδος με έγκριση ιδιοκτήτη (περισσότερες φορές, πιο πρόσφατα)·
 * και λέει **γιατί** τον καθένα. Εξαιρείται όποιος μόλις αρνήθηκε **αυτή** την ανάθεση.
 */
export function rankIssuanceCandidates(
  roster: readonly IssuanceRosterEntry[],
  target: { readonly kind: DocumentKind; readonly propertyId: string; readonly excludeContactId: string | null },
): readonly IssuanceCandidate[] {
  const approved = roster.filter((entry) => wasApproved(entry.record));
  const tally = tallyOf(approved, target.kind, target.propertyId);
  return [...tally]
    .filter(([id, entry]) => id !== target.excludeContactId && (entry.sameProperty !== null || entry.count > 0))
    .sort(([, a], [, b]) => Number(b.sameProperty !== null) - Number(a.sameProperty !== null)
      || b.count - a.count
      || b.lastAt.localeCompare(a.lastAt))
    .slice(0, ISSUANCE_CANDIDATES_SHOWN)
    .map(([contactId, entry]) => ({ contactId, reasons: reasonsOf(entry), credential: entry.credential }));
}
