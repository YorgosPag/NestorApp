/**
 * ADR-928 Φ2 — καθαρή μηχανή κύκλου ζωής + αριθμός εγγράφου.
 */

import { SUBCONTRACT_AGREEMENT_FSM, SUBCONTRACT_AGREEMENT_STATUSES, SUBCONTRACT_AGREEMENT_TRANSITIONS } from '../../types/agreement';
import type { ClauseSelection } from '../../types/commercial-terms';
import { nextAgreementNumber } from '../agreement-document-number';
import { refuseAssignment, refuseContentEdit, refuseTransition, spawnsAgreementOnAccept, statusAfter } from '../agreement-lifecycle';

const TODAY = '2026-11-03';
type Facts = Parameters<typeof refuseTransition>[0];
const facts = (patch: Partial<Facts> = {}): Facts => ({
  status: 'draft', role: 'offer', documentMode: 'offer_becomes_agreement', validUntil: null, clauses: [], ...patch,
});
const withDeviation = (decision: 'pending' | 'approved' | 'rejected'): ClauseSelection[] => [{
  clauseId: 'sccl_x', clauseKey: 'payment.instruments', version: 1, parameterValues: {},
  deviations: { instrument: { value: { kind: 'enum', value: 'cheque' }, reason: 'λόγος', requestedBy: 'u1', decision, decidedBy: null, decidedAt: null, decisionReason: null } },
}];

describe('πίνακας μεταβάσεων', () => {
  it('κάθε (κατάσταση, μετάβαση): επιτρέπεται ΑΚΡΙΒΩΣ ό,τι λέει το FSM (χωρίς φύλακα δεδομένων)', () => {
    for (const status of SUBCONTRACT_AGREEMENT_STATUSES) {
      for (const transition of SUBCONTRACT_AGREEMENT_TRANSITIONS) {
        const allowed = SUBCONTRACT_AGREEMENT_FSM[transition].from.includes(status);
        const refusal = refuseTransition(facts({ status, validUntil: transition === 'expire' ? '2026-01-01' : null }), transition, TODAY);
        expect([status, transition, refusal === null]).toEqual([status, transition, allowed]);
      }
    }
    expect(statusAfter('issue')).toBe('issued');
  });
});

describe('φύλακες δεδομένων', () => {
  it('issue: εκκρεμής ή απορριφθείσα απόκλιση μπλοκάρει· εγκεκριμένη όχι', () => {
    expect(refuseTransition(facts({ clauses: withDeviation('pending') }), 'issue', TODAY)).toBe('deviationsPending');
    expect(refuseTransition(facts({ clauses: withDeviation('rejected') }), 'issue', TODAY)).toBe('deviationsPending');
    expect(refuseTransition(facts({ clauses: withDeviation('approved') }), 'issue', TODAY)).toBeNull();
  });

  it('accept μετά τη λήξη ⇒ offerExpired· expire πριν τη λήξη ⇒ notYetExpired· ίδια μέρα = ακόμη ισχύει', () => {
    expect(refuseTransition(facts({ status: 'issued', validUntil: '2026-11-02' }), 'accept', TODAY)).toBe('offerExpired');
    expect(refuseTransition(facts({ status: 'issued', validUntil: TODAY }), 'accept', TODAY)).toBeNull();
    expect(refuseTransition(facts({ status: 'issued', validUntil: TODAY }), 'expire', TODAY)).toBe('notYetExpired');
    expect(refuseTransition(facts({ status: 'issued', validUntil: null }), 'expire', TODAY)).toBe('notYetExpired');
  });

  it('Τρόπος Β: η προσφορά γεννά συμφωνητικό και ΔΕΝ εγκαθίσταται η ίδια· το συμφωνητικό ναι', () => {
    const offerB = facts({ status: 'accepted', documentMode: 'offer_then_agreement' });
    expect(spawnsAgreementOnAccept(offerB)).toBe(true);
    expect(refuseTransition(offerB, 'mobilize', TODAY)).toBe('mobilizeOnOffer');
    expect(refuseTransition({ ...offerB, role: 'agreement' }, 'mobilize', TODAY)).toBeNull();
    expect(spawnsAgreementOnAccept({ role: 'offer', documentMode: 'offer_becomes_agreement' })).toBe(false);
  });

  it('περιεχόμενο μόνο στο πρόχειρο · ανάθεση μόνο σε πολλά έργα, μετά την αποδοχή', () => {
    expect(refuseContentEdit('draft')).toBeNull();
    expect(refuseContentEdit('issued')).toBe('invalidTransition');
    const multi = { kind: 'multi_project' as const, assignments: [] };
    expect(refuseAssignment({ status: 'accepted', scope: multi })).toBeNull();
    expect(refuseAssignment({ status: 'draft', scope: multi })).toBe('invalidTransition');
  });
});

describe('αριθμός εγγράφου', () => {
  it('ακολουθία ανά είδος και έτος, στον ίδιο μετρητή', () => {
    const first = nextAgreementNumber(null, 'comp', 'offer', TODAY);
    expect(first.documentNumber).toBe('ΠΡΟΣ-2026-001');
    const second = nextAgreementNumber(first.counter, 'comp', 'offer', TODAY);
    expect(second.documentNumber).toBe('ΠΡΟΣ-2026-002');
    expect(nextAgreementNumber(second.counter, 'comp', 'agreement', TODAY).documentNumber).toBe('ΣΥΜ-2026-001');
    expect(nextAgreementNumber(second.counter, 'comp', 'offer', '2027-01-02').documentNumber).toBe('ΠΡΟΣ-2027-001');
  });
});
