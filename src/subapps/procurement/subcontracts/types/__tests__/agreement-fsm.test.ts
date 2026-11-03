/**
 * ⚓ Ο πίνακας μεταβάσεων του συμφωνητικού (ADR-928 §5.5) — το διάγραμμα του ADR, ελεγμένο ως δεδομένα.
 */

import {
  SUBCONTRACT_AGREEMENT_FSM,
  SUBCONTRACT_AGREEMENT_STATUSES,
  type SubcontractAgreementStatus,
} from '../agreement';

const TERMINAL: readonly SubcontractAgreementStatus[] = ['completed', 'discarded', 'withdrawn', 'expired', 'terminated'];

const edges = Object.entries(SUBCONTRACT_AGREEMENT_FSM).flatMap(([transition, { from, to }]) =>
  from.map((source) => ({ transition, source, to })),
);

describe('SUBCONTRACT_AGREEMENT_FSM', () => {
  it('κάθε κατάσταση εκτός του draft είναι προσβάσιμη από κάποια μετάβαση', () => {
    const reachable = new Set(edges.map((e) => e.to));
    const unreachable = SUBCONTRACT_AGREEMENT_STATUSES.filter((s) => s !== 'draft' && !reachable.has(s));
    expect(unreachable).toEqual([]);
  });

  it('οι τελικές καταστάσεις δεν έχουν έξοδο — μετά το accepted, αλλαγή = τροποποίηση, όχι επανεγγραφή', () => {
    expect(edges.filter((e) => TERMINAL.includes(e.source))).toEqual([]);
  });

  it('το mobilize περνά μόνο από αποδεκτό έγγραφο (Υ.Γ. 2009: συμφωνητικό με την εγκατάσταση)', () => {
    expect(SUBCONTRACT_AGREEMENT_FSM.mobilize).toEqual({ from: ['accepted'], to: 'in_execution' });
  });

  it('καμία μετάβαση δεν οδηγεί στην ίδια κατάσταση από την οποία ξεκινά', () => {
    expect(edges.filter((e) => e.source === e.to)).toEqual([]);
  });
});
