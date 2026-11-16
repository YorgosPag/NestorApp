/**
 * ADR-943 — άγκυρες της προκαταβολής με κράτηση: όροι μέσα στην προσφορά (Κ-3) · κατάσταση ΠΑΡΑΓΟΜΕΝΗ από γεγονότα ·
 * γεγονότα χρημάτων μόνο από `system` (Κ-8) · ιδεμποτία από αναφορά παρόχου · παράθυρο αντίρρησης (Κ-4) · πολιτικές (Κ-5) ·
 * ΜΑΡΚ δεμένος στα χρήματα (Κ-7).
 */

import {
  advanceCollectedMinor,
  advanceStateOf,
  isAdvanceTermsValid,
  objectionUntilOf,
  refundDueOnCancelOf,
  type AdvanceState,
} from '@/lib/document-validity/issuance-advance';
import {
  issuanceStageOf,
  reduceIssuance,
  type IssuanceAction,
  type IssuanceActor,
  type IssuanceAssignmentRecord,
} from '@/lib/document-validity/issuance-assignment';
import type { QuoteTerms } from '@/lib/document-validity/issuance-quote';

const T0 = '2026-11-16T09:00:00.000Z';
const OFFICE: IssuanceActor = { kind: 'office', uid: 'uid_agent', nowIso: T0 };
const SYSTEM: IssuanceActor = { kind: 'system', source: 'payments', nowIso: T0 };
const ENGINEER: IssuanceActor = { kind: 'engagement', engagementId: 'eng_1', uid: 'uid_pro', nowIso: T0 };
const at = (actor: IssuanceActor, nowIso: string): IssuanceActor => ({ ...actor, nowIso });

const INSPECTOR = { qualification: 'energy-inspector-registered', registryNumber: 'ΥΠΕΝ-123' } as const;
/** 100,00 € + 24% = 124,00 € · προκαταβολή 40,00 €, μέτρια πολιτική. */
const TERMS: QuoteTerms = {
  basis: 'firm', amountMinor: 10_000, vatRatePercent: 24, vatIncluded: false, validUntil: '2026-12-31',
  scope: ['issuance'], note: null, deliveryBusinessDays: 5, advance: { amountMinor: 4_000, policy: 'moderate' },
};
const ASSIGNED: IssuanceAction[] = [
  { kind: 'propose', professionalContactId: 'cont_pro', credential: INSPECTOR },
  { kind: 'notify', channel: 'email', invitationId: null, note: null, verification: null },
  { kind: 'quote', terms: TERMS },
  { kind: 'decide', outcome: 'approved', channel: 'phone', note: null, ownerContactId: 'cont_lead', quoteRevision: 1, ownerAttestation: null },
];
const FUNDED: IssuanceAction = { kind: 'advance-funded', amountMinor: 4_000, paymentReference: 'pmt_1', withdrawalWaiverAt: T0 };
const START: IssuanceAction = { kind: 'start-work' };
const MARK = '123456789012345';

function act(record: IssuanceAssignmentRecord | null, action: IssuanceAction, actor: IssuanceActor) {
  return reduceIssuance('energy-certificate', record, null, action, actor);
}

function apply(record: IssuanceAssignmentRecord | null, action: IssuanceAction, actor: IssuanceActor): IssuanceAssignmentRecord {
  const reduced = act(record, action, actor);
  if (!reduced.ok) throw new Error(`${action.kind}: ${reduced.refusal}`);
  return reduced.record;
}

function runAll(actions: readonly IssuanceAction[]): IssuanceAssignmentRecord {
  let record: IssuanceAssignmentRecord | null = null;
  for (const action of actions) record = apply(record, action, OFFICE);
  if (record === null) throw new Error('no record');
  return record;
}
const assigned = () => runAll(ASSIGNED);
const funded = () => apply(assigned(), FUNDED, SYSTEM);
const started = () => apply(funded(), START, ENGINEER);
const stateOf = (record: IssuanceAssignmentRecord): AdvanceState => advanceStateOf(record);
const refusalOf = (record: IssuanceAssignmentRecord, action: IssuanceAction, actor: IssuanceActor) => {
  const reduced = act(record, action, actor);
  return reduced.ok ? null : reduced.refusal;
};

describe('ADR-943 Κ-3 — οι όροι της προκαταβολής', () => {
  it('θετικό ποσό, όχι πάνω από το σύνολο, γνωστή πολιτική', () => {
    expect(isAdvanceTermsValid({ amountMinor: 12_400, policy: 'strict' }, 12_400)).toBe(true);
    expect(isAdvanceTermsValid({ amountMinor: 12_401, policy: 'strict' }, 12_400)).toBe(false);
    expect(isAdvanceTermsValid({ amountMinor: 0, policy: 'strict' }, 12_400)).toBe(false);
    expect(isAdvanceTermsValid({ amountMinor: 10.5, policy: 'strict' }, 12_400)).toBe(false);
  });

  it('ο μειωτής αρνείται προσφορά με προκαταβολή πάνω από το σύνολο της (`terms-refused`)', () => {
    const sent = runAll(ASSIGNED.slice(0, 2));
    const tooMuch: IssuanceAction = { kind: 'quote', terms: { ...TERMS, advance: { amountMinor: 12_401, policy: 'flexible' } } };
    expect(act(sent, tooMuch, OFFICE)).toEqual({ ok: false, refusal: 'terms-refused' });
  });

  it('εγκεκριμένη προσφορά με προκαταβολή ⇒ «αναμένεται πληρωμή»· χωρίς προκαταβολή ⇒ «καμία»', () => {
    expect(stateOf(assigned())).toEqual({ kind: 'awaiting-payment', amountMinor: 4_000 });
    const record = assigned();
    if (record.quote === null) throw new Error('no quote');
    expect(stateOf({ ...record, quote: { ...record.quote, advance: null } })).toEqual({ kind: 'none' });
  });
});

describe('ADR-943 Κ-8 — γεγονότα χρημάτων μόνο από `system`, ιδεμποτία από αναφορά', () => {
  it('γραφείο ή μηχανικός δεν «δηλώνουν πληρωμή» (`actor-refused`)', () => {
    expect(refusalOf(assigned(), FUNDED, OFFICE)).toBe('actor-refused');
    expect(refusalOf(assigned(), FUNDED, ENGINEER)).toBe('actor-refused');
  });

  it('το system δεν κάνει πράξη της ανάθεσης (`actor-refused`)', () => {
    expect(refusalOf(assigned(), { kind: 'cancel' }, SYSTEM)).toBe('actor-refused');
  });

  it('πληρωμή ⇒ `held`· ίδια αναφορά ξανά (webhook + cron) ⇒ `changed: false`', () => {
    const record = funded();
    expect(stateOf(record)).toEqual({ kind: 'held', fundedMinor: 4_000, refundedMinor: 0 });
    const again = act(record, FUNDED, SYSTEM);
    expect(again.ok && again.changed).toBe(false);
  });

  it('άλλο ποσό από την εγκεκριμένη προκαταβολή ⇒ `terms-refused`· δεύτερη πληρωμή με άλλη αναφορά ⇒ `transition-refused`', () => {
    expect(refusalOf(assigned(), { ...FUNDED, amountMinor: 3_999 }, SYSTEM)).toBe('terms-refused');
    expect(refusalOf(funded(), { ...FUNDED, paymentReference: 'pmt_2' }, SYSTEM)).toBe('transition-refused');
  });

  it('μετά την πρώτη κίνηση χρημάτων η προσφορά δεν αναθεωρείται', () => {
    expect(refusalOf(funded(), { kind: 'quote', terms: TERMS }, OFFICE)).toBe('transition-refused');
  });
});

describe('ADR-943 Κ-4 — έναρξη, παράθυρο αντίρρησης, αποδέσμευση', () => {
  it('έναρξη μόνο από `held`, μόνο από τον μηχανικό· δεύτερη δήλωση ⇒ `changed: false`', () => {
    expect(refusalOf(assigned(), START, ENGINEER)).toBe('transition-refused');
    expect(refusalOf(funded(), START, OFFICE)).toBe('actor-refused');
    const record = started();
    expect(stateOf(record)).toEqual({ kind: 'release-pending', fundedMinor: 4_000, objectionUntil: objectionUntilOf(T0) });
    const again = act(record, START, ENGINEER);
    expect(again.ok && again.changed).toBe(false);
  });

  it('αποδέσμευση «έληξε το παράθυρο» μόνο μετά τις 48 ώρες', () => {
    const release: IssuanceAction = { kind: 'advance-released', amountMinor: 4_000, transferReference: 'tra_1', basis: 'window-elapsed' };
    expect(refusalOf(started(), release, at(SYSTEM, '2026-11-18T08:59:59.000Z'))).toBe('transition-refused');
    const record = apply(started(), release, at(SYSTEM, '2026-11-18T09:00:00.000Z'));
    expect(stateOf(record)).toEqual({ kind: 'released', fundedMinor: 4_000, releasedMinor: 4_000, refundedMinor: 0 });
  });

  it('αντίρρηση μόνο μέσα στο παράθυρο ⇒ `disputed`· τότε αποφασίζει το γραφείο', () => {
    const object: IssuanceAction = { kind: 'object-start', reason: 'Δεν ήρθε κανείς' };
    expect(refusalOf(started(), object, at(OFFICE, '2026-11-18T09:00:00.000Z'))).toBe('transition-refused');
    expect(refusalOf(started(), { kind: 'object-start', reason: '   ' }, OFFICE)).toBe('terms-refused');
    const disputed = apply(started(), object, OFFICE);
    expect(stateOf(disputed)).toEqual({ kind: 'disputed', fundedMinor: 4_000, reason: 'Δεν ήρθε κανείς' });
    const windowRelease: IssuanceAction = { kind: 'advance-released', amountMinor: 4_000, transferReference: 'tra_1', basis: 'window-elapsed' };
    expect(refusalOf(disputed, windowRelease, at(SYSTEM, '2026-11-20T09:00:00.000Z'))).toBe('transition-refused');
    const resolved = apply(disputed, { ...windowRelease, basis: 'office-resolution' }, SYSTEM);
    expect(stateOf(resolved).kind).toBe('released');
  });
});

describe('ADR-943 Κ-5 — πολιτικές ακύρωσης', () => {
  it('πριν από την έναρξη: πάντα ολόκληρο το εισπραχθέν', () => {
    expect(refundDueOnCancelOf(stateOf(funded()), 'strict')).toBe(4_000);
  });

  it('μετά την έναρξη: ευέλικτη 100% · μέτρια 50% · αυστηρή 0% επιστροφή', () => {
    const state = stateOf(started());
    expect(refundDueOnCancelOf(state, 'flexible')).toBe(4_000);
    expect(refundDueOnCancelOf(state, 'moderate')).toBe(2_000);
    expect(refundDueOnCancelOf(state, 'strict')).toBe(0);
  });

  it('η στρογγύλευση ευνοεί τον ιδιοκτήτη (μονό ποσό, μέτρια)', () => {
    const state: AdvanceState = { kind: 'release-pending', fundedMinor: 4_001, objectionUntil: T0 };
    expect(refundDueOnCancelOf(state, 'moderate')).toBe(2_001);
  });

  it('επιστροφή μετά από ακύρωση γράφεται· πάνω από το εισπραχθέν ⇒ `terms-refused`· ολική ⇒ `refunded`', () => {
    const cancelled = apply(funded(), { kind: 'cancel' }, OFFICE);
    expect(issuanceStageOf(cancelled)).toBe('cancelled');
    expect(refusalOf(cancelled, { kind: 'advance-refunded', amountMinor: 4_001, reference: 'ref_1' }, SYSTEM)).toBe('terms-refused');
    const refunded = apply(cancelled, { kind: 'advance-refunded', amountMinor: 4_000, reference: 'ref_1' }, SYSTEM);
    expect(stateOf(refunded)).toEqual({ kind: 'refunded', fundedMinor: 4_000, refundedMinor: 4_000 });
    expect(advanceCollectedMinor(stateOf(refunded))).toBe(0);
  });
});

describe('ADR-943 Κ-7 — ο ΜΑΡΚ δεμένος στα χρήματα', () => {
  it('ΜΑΡΚ προκαταβολής = ό,τι εισπράχθηκε· πριν από την πληρωμή ⇒ `receipt-mismatch`', () => {
    const receipt: IssuanceAction = { kind: 'record-advance-receipt', mark: MARK, issuedOn: '2026-11-16', totalMinor: 4_000 };
    expect(refusalOf(assigned(), receipt, ENGINEER)).toBe('receipt-mismatch');
    expect(refusalOf(funded(), { ...receipt, totalMinor: 12_400 }, ENGINEER)).toBe('receipt-mismatch');
    const record = apply(funded(), receipt, ENGINEER);
    expect(record.advanceReceipt?.totalMinor).toBe(4_000);
    expect(refusalOf(record, { ...receipt, mark: '999999999999999' }, OFFICE)).toBe('transition-refused');
  });

  it('τελικός ΜΑΡΚ = σύνολο − προκαταβολή (συμψηφισμός)', () => {
    const finalReceipt = (totalMinor: number): IssuanceAction => ({ kind: 'record-receipt', mark: MARK, issuedOn: '2026-11-20', totalMinor });
    expect(refusalOf(funded(), finalReceipt(12_400), OFFICE)).toBe('receipt-mismatch');
    expect(apply(funded(), finalReceipt(8_400), OFFICE).receipt?.totalMinor).toBe(8_400);
  });
});
