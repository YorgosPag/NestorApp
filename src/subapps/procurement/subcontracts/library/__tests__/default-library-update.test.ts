/**
 * ADR-928 §5.20 — ο κανόνας «upstream»: η σπορά προσφέρει νέα έκδοση **μόνο** όταν άλλαξε το κείμενο του Νέστορα από
 * την τελευταία φορά που το πρόσφερε· ποτέ πάνω σε πρόταση ανθρώπου, ποτέ ξανά ό,τι απορρίφθηκε.
 */

import { DEFAULT_LIBRARY_PROPOSER, type SubcontractClause, type SubcontractClauseVersion } from '../../types/clause';
import type { DefaultLibrarySeedReport } from '../../types/library-seed';
import { defaultLibraryUpdateOf, lastOfferedVersion, seedReportHasChanges } from '../default-library-update';

const SHIPPED = 'hash-shipped';
const OLD = 'hash-old';
const HUMAN = 'u-giorgio';

const clause = (patch: Partial<SubcontractClause> = {}): SubcontractClause => ({
  id: 'sccl_a', companyId: 'comp_1', clauseKey: 'a.key', title: { el: 'a' },
  currentVersion: null, latestVersion: 1, openProposal: 1, isArchived: false, revision: 1,
  createdAt: '2026-11-04T00:00:00.000Z', updatedAt: '2026-11-04T00:00:00.000Z', createdBy: 'u', updatedBy: 'u',
  ...patch,
});

const version = (n: number, patch: Partial<SubcontractClauseVersion> = {}): SubcontractClauseVersion => ({
  id: `sccv_a_${n}`, companyId: 'comp_1', clauseId: 'sccl_a', version: n, state: 'proposed', professionalReview: 'needs_professional_review',
  effectiveFrom: null, supersededBy: null, body: { heading: '', blocks: [] }, parameters: [], translations: {},
  contentHash: OLD, sourceHash: 's', proposedBy: DEFAULT_LIBRARY_PROPOSER, proposalReason: null,
  decidedBy: null, decidedAt: null, decisionReason: null, reviewedBy: null, reviewedAt: null, revision: 1,
  createdAt: '2026-11-04T00:00:00.000Z', updatedAt: '2026-11-04T00:00:00.000Z', updatedBy: 'u',
  ...patch,
});

describe('default-library-update — ο κανόνας upstream', () => {
  it('ίδιο κείμενο με την τελευταία προσφορά ⇒ τίποτα (ιδεμποτικό)', () => {
    expect(defaultLibraryUpdateOf(clause(), [version(1, { contentHash: SHIPPED })], SHIPPED)).toEqual({ kind: 'none' });
  });

  it('ανοιχτή πρόταση του συστήματος με παλιό κείμενο ⇒ αντικατάσταση', () => {
    const stale = version(1);
    expect(defaultLibraryUpdateOf(clause(), [stale], SHIPPED)).toEqual({ kind: 'replace', stale });
  });

  it('η απόρριψη τιμάται: απορριφθείσα προσφορά με το ίδιο κείμενο δεν ξαναπροσφέρεται', () => {
    const rejected = version(1, { state: 'rejected', contentHash: SHIPPED });
    expect(defaultLibraryUpdateOf(clause({ openProposal: null }), [rejected], SHIPPED)).toEqual({ kind: 'none' });
  });

  it('απορριφθείσα προσφορά, νέο κείμενο του Νέστορα ⇒ νέα πρόταση', () => {
    const rejected = version(1, { state: 'rejected' });
    expect(defaultLibraryUpdateOf(clause({ openProposal: null }), [rejected], SHIPPED)).toEqual({ kind: 'propose' });
  });

  it('η παραλλαγή του χώρου δεν πατιέται σιωπηλά — η ενημέρωση φτάνει ως πρόταση', () => {
    const versions = [version(1, { state: 'superseded' }), version(2, { state: 'approved', proposedBy: HUMAN, contentHash: 'hash-own' })];
    expect(defaultLibraryUpdateOf(clause({ currentVersion: 2, latestVersion: 2, openProposal: null }), versions, SHIPPED)).toEqual({ kind: 'propose' });
  });

  it('ο χώρος έχει ήδη σε ισχύ το κείμενο του Νέστορα ⇒ τίποτα', () => {
    const versions = [version(1, { state: 'superseded' }), version(2, { state: 'approved', proposedBy: HUMAN, contentHash: SHIPPED })];
    expect(defaultLibraryUpdateOf(clause({ currentVersion: 2, latestVersion: 2, openProposal: null }), versions, SHIPPED)).toEqual({ kind: 'none' });
  });

  it('ανοιχτή πρόταση ανθρώπου ⇒ αναβολή, καμία εγγραφή', () => {
    const versions = [version(1, { state: 'approved' }), version(2, { proposedBy: HUMAN })];
    expect(defaultLibraryUpdateOf(clause({ currentVersion: 1, latestVersion: 2, openProposal: 2 }), versions, SHIPPED)).toEqual({ kind: 'deferred' });
  });

  it('ρήτρα που ο Νέστορας δεν πρόσφερε ποτέ (ίδιο κλειδί, γραμμένη από τον χώρο) ⇒ τίποτα', () => {
    expect(defaultLibraryUpdateOf(clause(), [version(1, { proposedBy: HUMAN })], SHIPPED)).toEqual({ kind: 'none' });
  });

  it('αρχειοθετημένη ⇒ τίποτα', () => {
    expect(defaultLibraryUpdateOf(clause({ isArchived: true }), [version(1)], SHIPPED)).toEqual({ kind: 'none' });
  });

  it('η βάση είναι η ΤΕΛΕΥΤΑΙΑ προσφορά του συστήματος, όχι η πρώτη', () => {
    const versions = [version(3, { contentHash: 'c3' }), version(1, { contentHash: 'c1' }), version(2, { proposedBy: HUMAN })];
    expect(lastOfferedVersion(versions)?.version).toBe(3);
    expect(lastOfferedVersion([version(1, { proposedBy: HUMAN })])).toBeNull();
  });
});

describe('seedReportHasChanges — «η βιβλιοθήκη είναι ενημερωμένη»', () => {
  const report = (patch: Partial<DefaultLibrarySeedReport> = {}): DefaultLibrarySeedReport => ({
    clausesCreated: [], clausesExisting: ['a', 'b'], clausesUpdateProposed: [], clausesUpdateDeferred: [],
    templatesCreated: [], templatesExisting: ['t'], templatesPending: [{ code: 'p', issues: [] }],
    ...patch,
  });

  it('μόνο «υπήρχαν ήδη» και πρότυπα σε αναμονή ⇒ καμία αλλαγή (δεύτερος έλεγχος = ιδεμποτικός)', () => {
    expect(seedReportHasChanges(report())).toBe(false);
  });

  it.each<[string, Partial<DefaultLibrarySeedReport>]>([
    ['νέα ρήτρα', { clausesCreated: ['c'] }],
    ['νέα έκδοση προς έγκριση', { clausesUpdateProposed: ['a'] }],
    ['ενημέρωση που περιμένει πρόταση ανθρώπου', { clausesUpdateDeferred: ['a'] }],
    ['πρότυπο που γράφτηκε', { templatesCreated: ['t2'] }],
  ])('%s ⇒ αλλαγή', (_, patch) => {
    expect(seedReportHasChanges(report(patch))).toBe(true);
  });
});
