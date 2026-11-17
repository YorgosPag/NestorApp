/**
 * ADR-943 — άγκυρες της προκαταβολής με κράτηση: όροι μέσα στην προσφορά (Κ-3) · κατάσταση ΠΑΡΑΓΟΜΕΝΗ από γεγονότα ·
 * γεγονότα χρημάτων μόνο από `system` (Κ-8) · ιδεμποτία από αναφορά παρόχου · παράθυρο αντίρρησης (Κ-4) · πολιτικές (Κ-5) ·
 * ΜΑΡΚ δεμένος στα χρήματα (Κ-7).
 */

import {
  advanceCollectedMinor,
  advanceGlanceOf,
  advanceSettledAtOf,
  advanceStateOf,
  advanceTimelineOf,
  cancellationScheduleOf,
  isAdvancePageLive,
  isAdvanceTermsValid,
  isWithinWithdrawalPeriod,
  maxAdvanceMinorOf,
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
/** 100,00 € + 24% = 124,00 € · προκαταβολή 40,00 €, μέτρια πολιτική, αξία αυτοψίας 15,00 €. */
const TERMS: QuoteTerms = {
  basis: 'firm', amountMinor: 10_000, vatRatePercent: 24, vatIncluded: false, validUntil: '2026-12-31',
  scope: ['issuance'], note: null, deliveryBusinessDays: 5, advance: { amountMinor: 4_000, policy: 'moderate', inspectionValueMinor: 1_500 },
};
const ASSIGNED: IssuanceAction[] = [
  { kind: 'propose', professionalContactId: 'cont_pro', credential: INSPECTOR },
  { kind: 'notify', channel: 'email', invitationId: null, note: null, verification: null },
  { kind: 'quote', terms: TERMS },
  { kind: 'decide', outcome: 'approved', channel: 'phone', note: null, ownerContactId: 'cont_lead', quoteRevision: 1, ownerAttestation: null },
];
const FUNDED: IssuanceAction = { kind: 'advance-funded', amountMinor: 4_000, paymentReference: 'pmt_1', withdrawalWaiverAt: T0 };
/** Η έγκριση έγινε στο T0 (16/11)· η 14η ημέρα είναι η 30/11 (ώρα Ελλάδας). */
const WITHIN_WITHDRAWAL = '2026-11-30T20:00:00.000Z';
const AFTER_WITHDRAWAL = '2026-12-01T09:00:00.000Z';
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
  const advance = (amountMinor: number, inspectionValueMinor = 1_500) => ({ amountMinor, policy: 'strict' as const, inspectionValueMinor });

  it('Φ4 — ανώτατο 50% του συνόλου, στρογγύλευση υπέρ του ιδιοκτήτη', () => {
    expect(maxAdvanceMinorOf(12_400)).toBe(6_200);
    expect(maxAdvanceMinorOf(12_401)).toBe(6_200);
    expect(isAdvanceTermsValid(advance(6_200), 12_400)).toBe(true);
    expect(isAdvanceTermsValid(advance(6_201), 12_400)).toBe(false);
  });

  it('θετικό ακέραιο ποσό, γνωστή πολιτική, αξία αυτοψίας θετική και ως το σύνολο', () => {
    expect(isAdvanceTermsValid(advance(0), 12_400)).toBe(false);
    expect(isAdvanceTermsValid(advance(10.5), 12_400)).toBe(false);
    expect(isAdvanceTermsValid(advance(4_000, 0), 12_400)).toBe(false);
    expect(isAdvanceTermsValid(advance(4_000, 12_400), 12_400)).toBe(true);
    expect(isAdvanceTermsValid(advance(4_000, 12_401), 12_400)).toBe(false);
  });

  it('ο μειωτής αρνείται προσφορά με προκαταβολή πάνω από το όριο (`terms-refused`)', () => {
    const sent = runAll(ASSIGNED.slice(0, 2));
    const tooMuch: IssuanceAction = { kind: 'quote', terms: { ...TERMS, advance: advance(6_201) } };
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
    expect(stateOf(record)).toEqual({ kind: 'release-pending', fundedMinor: 4_000, refundedMinor: 0, objectionUntil: objectionUntilOf(T0) });
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
    expect(stateOf(disputed)).toEqual({ kind: 'disputed', fundedMinor: 4_000, refundedMinor: 0, reason: 'Δεν ήρθε κανείς', resolution: null });
    const windowRelease: IssuanceAction = { kind: 'advance-released', amountMinor: 4_000, transferReference: 'tra_1', basis: 'window-elapsed' };
    expect(refusalOf(disputed, windowRelease, at(SYSTEM, '2026-11-20T09:00:00.000Z'))).toBe('transition-refused');
    // ADR-943 Φ5γ (Θ-5): αποδέσμευση «απόφαση γραφείου» μόνο ΑΦΟΥ καταγραφεί η απόφαση.
    expect(refusalOf(disputed, { ...windowRelease, basis: 'office-resolution' }, SYSTEM)).toBe('transition-refused');
    const decided = apply(disputed, { kind: 'resolve-advance-dispute', releaseMinor: 4_000, reason: 'Η αυτοψία έγινε' }, OFFICE);
    const resolved = apply(decided, { ...windowRelease, basis: 'office-resolution' }, SYSTEM);
    expect(stateOf(resolved).kind).toBe('released');
  });
});

describe('ADR-943 Φ5α — η ματιά της προκαταβολής (μία για κάθε οθόνη)', () => {
  it('χωρίς προκαταβολή ⇒ null· εγκρίθηκε ⇒ αναμένεται πληρωμή με τους όρους της συμφωνίας', () => {
    expect(advanceGlanceOf(runAll(ASSIGNED.slice(0, 1)))).toBeNull();
    expect(advanceGlanceOf(assigned())).toEqual({ terms: TERMS.advance, state: 'awaiting-payment', releaseAt: null, collectedMinor: 0 });
  });

  it('μετά την αυτοψία ⇒ πότε αποδεσμεύεται (το ΙΔΙΟ `objectionUntil` με τον μειωτή)· μετά την αποδέσμευση ⇒ καμία ώρα', () => {
    expect(advanceGlanceOf(funded())).toMatchObject({ state: 'held', releaseAt: null, collectedMinor: 4_000 });
    expect(advanceGlanceOf(started())).toMatchObject({ state: 'release-pending', releaseAt: objectionUntilOf(T0), collectedMinor: 4_000 });
    const release: IssuanceAction = { kind: 'advance-released', amountMinor: 4_000, transferReference: 'tra_1', basis: 'window-elapsed' };
    const released = apply(started(), release, at(SYSTEM, objectionUntilOf(T0)));
    expect(advanceGlanceOf(released)).toMatchObject({ state: 'released', releaseAt: null, collectedMinor: 4_000 });
  });
});

describe('ADR-943 Φ5β — η σελίδα του ιδιοκτήτη: αντίρρηση με σύνδεσμο · χρονολόγιο · ζωή της σελίδας', () => {
  const LINK: IssuanceActor = { kind: 'link', invitationId: 'dinv_owner', verifiedBy: 'link', nowIso: T0 };
  const OBJECT: IssuanceAction = { kind: 'object-start', reason: 'Δεν ήρθε κανείς' };
  const RELEASE: IssuanceAction = { kind: 'advance-released', amountMinor: 4_000, transferReference: 'tra_1', basis: 'window-elapsed' };

  it('ο σύνδεσμος φέρνει αντίρρηση ⇒ `owner-link` (ο δράστης από τον actor, ποτέ από το αίτημα)', () => {
    const disputed = apply(started(), OBJECT, LINK);
    expect(stateOf(disputed).kind).toBe('disputed');
    expect(disputed.advanceEvents.at(-1)).toMatchObject({ kind: 'start-objected', objection: { by: 'owner-link', invitationId: 'dinv_owner' } });
  });

  it('ο σύνδεσμος ΔΕΝ γράφει τίποτα άλλο της προκαταβολής, ούτε αντίρρηση έξω από το παράθυρο', () => {
    expect(refusalOf(started(), OBJECT, at(LINK, objectionUntilOf(T0)))).toBe('transition-refused');
    expect(refusalOf(funded(), OBJECT, LINK)).toBe('transition-refused');
    expect(refusalOf(funded(), START, LINK)).toBe('actor-refused');
    expect(refusalOf(started(), RELEASE, at(LINK, objectionUntilOf(T0)))).toBe('actor-refused');
  });

  it('χρονολόγιο: τα γεγονότα με τη σειρά τους, χωρίς αιτιολογίες (Ε-9′)', () => {
    const timeline = advanceTimelineOf(apply(started(), OBJECT, LINK));
    expect(timeline).toEqual([
      { kind: 'funded', at: T0, amountMinor: 4_000 },
      { kind: 'work-started', at: T0 },
      { kind: 'start-objected', at: T0, by: 'owner-link' },
    ]);
    expect(JSON.stringify(timeline)).not.toContain('Δεν ήρθε κανείς');
  });

  it('η σελίδα ζει όσο ζουν τα χρήματα + 30 ημέρες (Ζ-1)', () => {
    expect(advanceSettledAtOf(started())).toBeNull();
    expect(isAdvancePageLive(started(), '2027-12-31T00:00:00.000Z')).toBe(true);
    const settledAt = objectionUntilOf(T0);
    const released = apply(started(), RELEASE, at(SYSTEM, settledAt));
    expect(advanceSettledAtOf(released)).toBe(settledAt);
    const day = 86_400_000;
    expect(isAdvancePageLive(released, new Date(Date.parse(settledAt) + 30 * day - 1).toISOString())).toBe(true);
    expect(isAdvancePageLive(released, new Date(Date.parse(settledAt) + 30 * day).toISOString())).toBe(false);
  });
});

describe('ADR-943 Κ-5 — πολιτικές ακύρωσης', () => {
  /** Η ίδια συμφωνία με άλλη πολιτική — η αναθεώρηση μένει ίδια, άρα η έγκριση την καλύπτει. */
  const withPolicy = (record: IssuanceAssignmentRecord, policy: 'flexible' | 'moderate' | 'strict'): IssuanceAssignmentRecord => {
    if (record.quote === null || record.quote.advance === null) throw new Error('no advance');
    return { ...record, quote: { ...record.quote, advance: { ...record.quote.advance, policy } } };
  };
  const withoutWaiver = (record: IssuanceAssignmentRecord): IssuanceAssignmentRecord => ({
    ...record, advanceEvents: record.advanceEvents.map((event) => (event.kind === 'funded' ? { ...event, withdrawalWaiverAt: null } : event)),
  });

  it('πριν από την έναρξη: πάντα ολόκληρο το εισπραχθέν', () => {
    expect(refundDueOnCancelOf(withPolicy(funded(), 'strict'), AFTER_WITHDRAWAL)).toBe(4_000);
  });

  it('μετά την έναρξη, μετά τις 14 ημέρες: ευέλικτη 100% · μέτρια 50% · αυστηρή 0% επιστροφή', () => {
    expect(refundDueOnCancelOf(withPolicy(started(), 'flexible'), AFTER_WITHDRAWAL)).toBe(4_000);
    expect(refundDueOnCancelOf(withPolicy(started(), 'moderate'), AFTER_WITHDRAWAL)).toBe(2_000);
    expect(refundDueOnCancelOf(withPolicy(started(), 'strict'), AFTER_WITHDRAWAL)).toBe(0);
  });

  it('υπαναχώρηση (3ι §3): μέσα στις 14 ημέρες κρατείται το πολύ η αξία της αυτοψίας', () => {
    expect(refundDueOnCancelOf(withPolicy(started(), 'strict'), WITHIN_WITHDRAWAL)).toBe(2_500);
    expect(refundDueOnCancelOf(withPolicy(started(), 'moderate'), WITHIN_WITHDRAWAL)).toBe(2_500);
    expect(refundDueOnCancelOf(withPolicy(started(), 'flexible'), WITHIN_WITHDRAWAL)).toBe(4_000);
  });

  it('υπαναχώρηση (3ι §4 α ii): χωρίς ρητό αίτημα έναρξης δεν κρατείται τίποτα', () => {
    expect(refundDueOnCancelOf(withoutWaiver(withPolicy(started(), 'strict')), WITHIN_WITHDRAWAL)).toBe(4_000);
    expect(refundDueOnCancelOf(withoutWaiver(withPolicy(started(), 'strict')), AFTER_WITHDRAWAL)).toBe(0);
  });

  it('η προθεσμία: ως και την 14η ημέρα μετά την έγκριση, σε ώρα Ελλάδας', () => {
    expect(isWithinWithdrawalPeriod(assigned(), WITHIN_WITHDRAWAL)).toBe(true);
    // 30/11 22:00 UTC = 1/12 00:00 Αθήνα ⇒ έξω.
    expect(isWithinWithdrawalPeriod(assigned(), '2026-11-30T22:00:00.000Z')).toBe(false);
    expect(isWithinWithdrawalPeriod({ ...assigned(), decision: null }, T0)).toBe(false);
  });

  it('ο πίνακας ακύρωσης = οι ίδιοι κανόνες· η στρογγύλευση ευνοεί τον ιδιοκτήτη', () => {
    expect(cancellationScheduleOf({ amountMinor: 4_001, policy: 'moderate', inspectionValueMinor: 9_999 })).toEqual([
      { when: 'before-start', refundMinor: 4_001, retainedMinor: 0 },
      { when: 'after-start-within-withdrawal', refundMinor: 2_001, retainedMinor: 2_000 },
      { when: 'after-start-later', refundMinor: 2_001, retainedMinor: 2_000 },
    ]);
    expect(cancellationScheduleOf({ amountMinor: 4_000, policy: 'strict', inspectionValueMinor: 1_500 })[1]).toEqual(
      { when: 'after-start-within-withdrawal', refundMinor: 2_500, retainedMinor: 1_500 },
    );
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
