/**
 * ADR-928 Φ3α-2 — η λίστα συμφωνητικών ανά έργο ως δεδομένα, και οι ενέργειες γραμμής με τους ΙΔΙΟΥΣ κριτές του γραφέα.
 */

import { LIBRARY, sampleAgreement, sampleProjectIdentity, SAMPLE_LINE } from '@/subapps/procurement/subcontracts/agreements/__tests__/agreement-fixtures';
import type { ClauseSelection } from '@/subapps/procurement/subcontracts/types/commercial-terms';
import {
  COMMITTED_STATUSES,
  filterListRows,
  PENDING_STATUSES,
  phaseTotal,
  statusTotals,
  toListRows,
} from '../subcontract-list-view';
import { CONFIRMED_TRANSITIONS, DESTRUCTIVE_TRANSITIONS, rowActionsOf, type RowActionContext } from '../subcontract-row-actions';

const TODAY = '2026-11-03';
const context = (patch: Partial<RowActionContext> = {}): RowActionContext => ({ today: TODAY, library: LIBRARY, actorUid: 'u_author', ...patch });

const priced = (amount: number) => [{ ...SAMPLE_LINE, pricing: 'lump_sum' as const, unitPrice: amount }];

const master = sampleAgreement({
  id: 'sca_master',
  documentNumber: 'ΣΥΜ-2026-004',
  scope: {
    kind: 'multi_project',
    assignments: [
      { id: 'scas_1', project: sampleProjectIdentity('proj_2'), startDate: '2026-10-01', durationDays: null, note: null, assignedBy: 'u', assignedAt: '' },
      { id: 'scas_2', project: sampleProjectIdentity('proj_1'), startDate: '2026-12-01', durationDays: 40, note: null, assignedBy: 'u', assignedAt: '' },
    ],
  },
  projectIds: ['proj_2', 'proj_1'],
});

describe('subcontract-list-view', () => {
  it('κύρια σύμβαση: η γραμμή δείχνει την εντολή εργασίας ΑΥΤΟΥ του έργου, όχι άλλου', () => {
    const [row] = toListRows([master], 'proj_1');
    expect(row.assignment).toEqual({ startDate: '2026-12-01', durationDays: 40 });
    expect(toListRows([sampleAgreement()], 'proj_1')[0].assignment).toBeNull();
  });

  it('§5.24 λίστα της εταιρείας (`projectId: null`): καμία «εντολή αυτού του έργου», μετρά εντολές και ΔΙΑΦΟΡΕΤΙΚΑ έργα', () => {
    const [row] = toListRows([master], null);
    expect(row.assignment).toBeNull();
    expect(row.workOrders).toEqual({ count: 2, projects: 2 });
    const again = { ...master, scope: { kind: 'multi_project' as const, assignments: [...(master.scope.kind === 'multi_project' ? master.scope.assignments : []), { id: 'scas_3', project: sampleProjectIdentity('proj_1'), startDate: null, durationDays: null, note: null, assignedBy: 'u', assignedAt: '' }] } };
    expect(toListRows([again], null)[0].workOrders).toEqual({ count: 3, projects: 2 });
    expect(toListRows([sampleAgreement()], null)[0].workOrders).toBeNull();
  });

  it('αναζήτηση σε αριθμό, υπεργολάβο, ΑΦΜ και τίτλο σε ΚΑΘΕ γλώσσα· φίλτρο κατάστασης', () => {
    const rows = toListRows([sampleAgreement(), master], 'proj_1');
    expect(filterListRows(rows, [], 'συμ-2026').map((row) => row.agreement.id)).toEqual(['sca_master']);
    expect(filterListRows(rows, [], '123456789')).toHaveLength(2);
    expect(filterListRows(rows, [], 'plastering')).toHaveLength(2);
    expect(filterListRows(rows, ['issued'], '')).toHaveLength(0);
  });

  it('σύνολα ανά φάση: δεσμευμένο vs σε εκκρεμότητα, με πλήθος μερικών ποσών', () => {
    const rows = toListRows([
      sampleAgreement({ id: 'a', status: 'draft', lines: priced(10_000) }),
      sampleAgreement({ id: 'b', status: 'in_execution', lines: priced(50_000) }),
      sampleAgreement({ id: 'c', status: 'accepted', lines: [SAMPLE_LINE] }),
      sampleAgreement({ id: 'd', status: 'discarded', lines: priced(99_000) }),
    ], 'proj_1');
    const totals = statusTotals(rows);
    expect(phaseTotal(totals, COMMITTED_STATUSES)).toEqual({ count: 2, amount: 50_000, partial: 1 });
    expect(phaseTotal(totals, PENDING_STATUSES)).toEqual({ count: 1, amount: 10_000, partial: 0 });
    expect(totals.discarded.count).toBe(1);
  });

  it('απόκλιση εκκρεμής ή απορριφθείσα ⇒ σήμα στη γραμμή', () => {
    const rows = toListRows([sampleAgreement({ clauses: deviated('rejected') })], 'proj_1');
    expect(rows[0].deviationsOpen).toBe(true);
  });
});

function deviated(decision: 'pending' | 'approved' | 'rejected'): ClauseSelection[] {
  const base = sampleAgreement().clauses;
  return [base[0], {
    ...base[1],
    deviations: { instrument: { value: { kind: 'enum', value: 'cheque' }, reason: 'λόγος', requestedBy: 'u1', decision, decidedBy: null, decidedAt: null, decisionReason: null } },
  }];
}

describe('subcontract-row-actions — οι κριτές του γραφέα στην οθόνη', () => {
  it('πρόχειρο: «Έκδοση» ενεργή όταν η βιβλιοθήκη το δέχεται· «Απόρριψη» καταστρεπτική· και οι δύο ζητούν επιβεβαίωση', () => {
    const actions = rowActionsOf(sampleAgreement(), context());
    expect(actions.map((action) => [action.transition, action.destructive, action.confirm, action.block])).toEqual([
      ['issue', false, true, null],
      ['discard', true, true, null],
    ]);
  });

  it('ADR-928 §5.24.5: επιβεβαίωση = ό,τι δεν αναιρείται — οι καταστρεπτικές ΚΑΙ έκδοση/αποδοχή, όχι οι υπόλοιπες', () => {
    expect([...CONFIRMED_TRANSITIONS].sort()).toEqual(['accept', 'discard', 'issue', 'terminate', 'withdraw']);
    for (const transition of DESTRUCTIVE_TRANSITIONS) expect(CONFIRMED_TRANSITIONS.has(transition)).toBe(true);
  });

  it('απόκλιση σε εκκρεμότητα ⇒ «Έκδοση» ανενεργή με την ΙΔΙΑ άρνηση που θα έδινε ο γραφέας', () => {
    const [issue] = rowActionsOf(sampleAgreement({ clauses: deviated('pending') }), context());
    expect(issue.block).toEqual({ kind: 'refusal', refusal: 'deviationsPending' });
  });

  it('η βιβλιοθήκη προχώρησε ⇒ «Έκδοση» ανενεργή με `clauseVersionOutdated` (όπως το 422 του γραφέα)', () => {
    const advanced = new Map(LIBRARY).set('payment.instruments', { ...LIBRARY.get('payment.instruments')!, version: 3 });
    const [issue] = rowActionsOf(sampleAgreement(), context({ library: advanced }));
    expect(issue.block).toEqual({ kind: 'issue', issue: expect.objectContaining({ code: 'clauseVersionOutdated' }) });
  });

  it('fail-closed: όσο η βιβλιοθήκη φορτώνει, η «Έκδοση» ΔΕΝ ανάβει', () => {
    const [issue] = rowActionsOf(sampleAgreement(), context({ library: null }));
    expect(issue.block).toEqual({ kind: 'checking' });
  });

  it('μόνο οι μεταβάσεις ΑΠΟ την τρέχουσα κατάσταση· τερματική ⇒ καμία', () => {
    expect(rowActionsOf(sampleAgreement({ status: 'in_execution', role: 'agreement' }), context()).map((a) => a.transition)).toEqual(['complete', 'terminate']);
    expect(rowActionsOf(sampleAgreement({ status: 'completed' }), context())).toEqual([]);
  });

  it('εκδοθείσα με παρελθούσα ισχύ: «Αποδοχή» μπλοκαρισμένη, «Λήξη» διαθέσιμη', () => {
    const actions = rowActionsOf(sampleAgreement({ status: 'issued', validUntil: '2026-10-01' }), context());
    expect(actions.find((a) => a.transition === 'accept')?.block).toEqual({ kind: 'refusal', refusal: 'offerExpired' });
    expect(actions.find((a) => a.transition === 'expire')?.block).toBeNull();
  });
});
