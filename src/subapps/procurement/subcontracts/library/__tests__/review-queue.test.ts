import { DEFAULT_LIBRARY_PROPOSER, type SubcontractClause, type SubcontractClauseVersion } from '../../types/clause';
import { reviewQueueOf, seedProgressOf } from '../review-queue';

const clause = (clauseKey: string, patch: Partial<SubcontractClause> = {}): SubcontractClause => ({
  id: `sccl_${clauseKey}`, companyId: 'comp_1', clauseKey, title: { el: clauseKey },
  currentVersion: null, latestVersion: 1, openProposal: 1, isArchived: false, revision: 1,
  createdAt: '2026-11-04T00:00:00.000Z', updatedAt: '2026-11-04T00:00:00.000Z', createdBy: 'u', updatedBy: 'u',
  ...patch,
});

const version = (clauseId: string, patch: Partial<SubcontractClauseVersion> = {}): SubcontractClauseVersion => ({
  id: `sccv_${clauseId}`, companyId: 'comp_1', clauseId, version: 1, state: 'proposed', professionalReview: 'needs_professional_review',
  effectiveFrom: null, supersededBy: null, body: { heading: '', blocks: [] }, parameters: [], translations: {},
  contentHash: 'c', sourceHash: 's', proposedBy: DEFAULT_LIBRARY_PROPOSER, proposalReason: null,
  decidedBy: null, decidedAt: null, decisionReason: null, reviewedBy: null, reviewedAt: null, revision: 1,
  createdAt: '2026-11-04T00:00:00.000Z', updatedAt: '2026-11-04T00:00:00.000Z', updatedBy: 'u',
  ...patch,
});

describe('review-queue — ουρά ελέγχου', () => {
  it('πρώτα όσες πρότεινε άνθρωπος, μετά του συστήματος, αλφαβητικά μέσα στην ομάδα', () => {
    const clauses = [clause('b.sys'), clause('a.sys'), clause('z.human')];
    const proposals = new Map(clauses.map((c) => [c.id, version(c.id, { proposedBy: c.clauseKey === 'z.human' ? 'u-1' : DEFAULT_LIBRARY_PROPOSER })]));
    expect(reviewQueueOf(clauses, proposals, new Map()).map((item) => item.clause.clauseKey)).toEqual(['z.human', 'a.sys', 'b.sys']);
  });

  it('καμία έγκριση χωρίς κείμενο: πρόταση που δεν έφτασε ή άλλης έκδοσης δεν μπαίνει', () => {
    const waiting = clause('a.wait', { openProposal: 2, latestVersion: 2 });
    const proposals = new Map([[waiting.id, version(waiting.id, { version: 1 })]]);
    expect(reviewQueueOf([waiting, clause('b.none')], proposals, new Map())).toEqual([]);
  });

  it('αρχειοθετημένη ή χωρίς ανοιχτή πρόταση δεν μπαίνει', () => {
    const archived = clause('a', { isArchived: true });
    const closed = clause('b', { openProposal: null, currentVersion: 1 });
    const proposals = new Map([[archived.id, version(archived.id)], [closed.id, version(closed.id)]]);
    expect(reviewQueueOf([archived, closed], proposals, new Map())).toEqual([]);
  });
});

describe('review-queue — πρόοδος σποράς', () => {
  it('εγκεκριμένες · εκκρεμείς · απορριφθείσες · αφόρτωτες, και νομικός έλεγχος σε εκκρεμότητα', () => {
    const approved = clause('k.ok', { currentVersion: 1, openProposal: null });
    const reviewed = clause('k.reviewed', { currentVersion: 1, openProposal: null });
    const pending = clause('k.pending');
    const rejected = clause('k.rejected', { openProposal: null });
    const current = new Map([
      [approved.id, version(approved.id, { state: 'approved' })],
      [reviewed.id, version(reviewed.id, { state: 'approved', professionalReview: 'reviewed' })],
    ]);
    const progress = seedProgressOf(['k.ok', 'k.reviewed', 'k.pending', 'k.rejected', 'k.missing'], [approved, reviewed, pending, rejected], current);
    expect(progress).toEqual({
      total: 5, counts: { approved: 2, pending: 1, rejected: 1, missing: 1 }, awaitingProfessionalReview: 1, complete: false,
    });
  });

  it('ολοκληρωμένη μόνο όταν όλες έχουν απόφαση — η απόρριψη είναι απόφαση, όχι «εντάξει»', () => {
    const done = seedProgressOf(['a', 'b'], [clause('a', { currentVersion: 1, openProposal: null }), clause('b', { openProposal: null })], new Map());
    expect(done.complete).toBe(true);
    expect(done.counts).toMatchObject({ approved: 1, rejected: 1 });
  });
});
