/**
 * @fileoverview **Η ουρά ελέγχου της βιβλιοθήκης και η πρόοδος της σποράς** — καθαρό (ADR-928 Φ3γ-0).
 * @module subapps/procurement/subcontracts/library/review-queue
 *
 * 🔑 Η σπορά δεν είναι «κουμπί που τελείωσε»: είναι **κατάλογος ελέγχου**. Η πρόοδος μετρά ανά ρήτρα της προτεινόμενης
 *    βιβλιοθήκης σε ποια κατάσταση βρίσκεται στον χώρο — εγκεκριμένη · σε εκκρεμότητα · απορρίφθηκε · δεν φορτώθηκε — και
 *    πόσες εγκεκριμένες περιμένουν ακόμη **νομικό** έλεγχο. Απορριφθείσα **δεν** είναι «ελεγμένη και εντάξει».
 * 🔑 Σειρά της ουράς: πρώτα όσες πρότεινε **άνθρωπος** (κάποιος περιμένει απάντηση), μετά του συστήματος, και μέσα σε
 *    κάθε ομάδα αλφαβητικά κατά κλειδί — σταθερή, ώστε το J/K να μην «πηδά» όταν φτάνει στιγμιότυπο.
 */

import { DEFAULT_LIBRARY_PROPOSER, type ClauseKey, type SubcontractClause, type SubcontractClauseVersion } from '../types/clause';

export interface ReviewQueueItem {
  readonly clause: SubcontractClause;
  readonly proposal: SubcontractClauseVersion;
  /** Η έκδοση σε ισχύ με την οποία συγκρίνεται η πρόταση — `null` για νέα ρήτρα. */
  readonly current: SubcontractClauseVersion | null;
}

const byHumanFirst = (item: ReviewQueueItem): number => (item.proposal.proposedBy === DEFAULT_LIBRARY_PROPOSER ? 1 : 0);

/**
 * Οι ανοιχτές προτάσεις του χώρου. `proposals` / `current`: ανά id ρήτρας, όσες έχουν φτάσει. Ρήτρα με `openProposal`
 * χωρίς φτασμένη έκδοση **δεν** μπαίνει ακόμη (καμία έγκριση χωρίς ορατό κείμενο).
 */
export function reviewQueueOf(
  clauses: readonly SubcontractClause[],
  proposals: ReadonlyMap<string, SubcontractClauseVersion>,
  current: ReadonlyMap<string, SubcontractClauseVersion>,
): ReviewQueueItem[] {
  return clauses
    .flatMap((clause): ReviewQueueItem[] => {
      const proposal = proposals.get(clause.id);
      if (clause.isArchived || clause.openProposal === null || proposal?.version !== clause.openProposal) return [];
      return [{ clause, proposal, current: current.get(clause.id) ?? null }];
    })
    .sort((a, b) => byHumanFirst(a) - byHumanFirst(b) || a.clause.clauseKey.localeCompare(b.clause.clauseKey));
}

export type SeedClauseState = 'approved' | 'pending' | 'rejected' | 'missing';

export interface SeedProgress {
  readonly total: number;
  readonly counts: Readonly<Record<SeedClauseState, number>>;
  /** Εγκεκριμένες που περιμένουν ακόμη νομικό/επαγγελματικό έλεγχο. */
  readonly awaitingProfessionalReview: number;
  /** Όλες έχουν απόφαση (εγκρίθηκαν ή απορρίφθηκαν) — καμία εκκρεμής ή αφόρτωτη. */
  readonly complete: boolean;
}

function seedStateOf(clause: SubcontractClause | undefined): SeedClauseState {
  if (!clause) return 'missing';
  if (clause.currentVersion !== null) return 'approved';
  return clause.openProposal !== null ? 'pending' : 'rejected';
}

/** Η πρόοδος του ελέγχου της προτεινόμενης βιβλιοθήκης στον χώρο. */
export function seedProgressOf(
  seedKeys: readonly ClauseKey[],
  clauses: readonly SubcontractClause[],
  current: ReadonlyMap<string, SubcontractClauseVersion>,
): SeedProgress {
  const byKey = new Map(clauses.map((clause) => [clause.clauseKey, clause]));
  const counts: Record<SeedClauseState, number> = { approved: 0, pending: 0, rejected: 0, missing: 0 };
  let awaitingProfessionalReview = 0;
  for (const key of seedKeys) {
    const clause = byKey.get(key);
    const state = seedStateOf(clause);
    counts[state] += 1;
    if (state === 'approved' && clause && current.get(clause.id)?.professionalReview === 'needs_professional_review') awaitingProfessionalReview += 1;
  }
  return { total: seedKeys.length, counts, awaitingProfessionalReview, complete: counts.pending === 0 && counts.missing === 0 };
}
