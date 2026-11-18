/**
 * ADR-943 Φ5γ — άγκυρες της ΜΙΑΣ κρίσης «ποια κίνηση κρατημένων χρημάτων οφείλεται;» (Θ-1): ακύρωση κατά την πολιτική
 * τη στιγμή της ακύρωσης (Ζ-4) · διαφορά παγώνει τα χρήματα (Θ-4) · απόφαση γραφείου οριστική και υπερισχύει (Θ-5) ·
 * σύνολα σταθερά μετά από μερική κίνηση · νέα πρόταση περιμένει όσο ζουν χρήματα (Θ-8).
 */

import { advanceStateOf } from '@/lib/document-validity/issuance-advance';
import { advanceSettlementDueOf, cancellationPreviewOf } from '@/lib/document-validity/issuance-advance-settlement';
import {
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

/** 40,00 € προκαταβολή, μέτρια πολιτική (κρατά 50% μετά την έναρξη), αξία αυτοψίας 15,00 €, ρητό αίτημα έναρξης στο T0. */
const TERMS: QuoteTerms = {
  basis: 'firm', amountMinor: 10_000, vatRatePercent: 24, vatIncluded: false, validUntil: '2026-12-31',
  scope: ['issuance'], note: null, deliveryBusinessDays: 5, advance: { amountMinor: 4_000, policy: 'moderate', inspectionValueMinor: 1_500 },
};
const ASSIGNED: readonly IssuanceAction[] = [
  { kind: 'propose', professional: { kind: 'contact', contactId: 'cont_pro' }, credential: { qualification: 'energy-inspector-registered', registryNumber: 'ΥΠΕΝ-1' } },
  { kind: 'notify', channel: 'email', invitationId: null, note: null, verification: null },
  { kind: 'quote', terms: TERMS },
  { kind: 'decide', outcome: 'approved', channel: 'phone', note: null, ownerContactId: 'cont_lead', quoteRevision: 1, ownerAttestation: null },
];
const WITHIN_WITHDRAWAL = '2026-11-30T20:00:00.000Z';
const AFTER_WITHDRAWAL = '2026-12-01T09:00:00.000Z';
const CANCEL: IssuanceAction = { kind: 'cancel', reason: 'cancelled' };

function act(record: IssuanceAssignmentRecord | null, action: IssuanceAction, actor: IssuanceActor) {
  return reduceIssuance('energy-certificate', record, null, action, actor);
}

function apply(record: IssuanceAssignmentRecord | null, action: IssuanceAction, actor: IssuanceActor): IssuanceAssignmentRecord {
  const reduced = act(record, action, actor);
  if (!reduced.ok) throw new Error(`${action.kind}: ${reduced.refusal}`);
  return reduced.record;
}

function funded(): IssuanceAssignmentRecord {
  const record = ASSIGNED.reduce<IssuanceAssignmentRecord | null>((current, action) => apply(current, action, OFFICE), null);
  if (record === null) throw new Error('no record');
  return apply(record, { kind: 'advance-funded', amountMinor: 4_000, paymentReference: 'pmt_1', withdrawalWaiverAt: T0 }, SYSTEM);
}
const started = () => apply(funded(), { kind: 'start-work' }, ENGINEER);
const disputed = () => apply(started(), { kind: 'object-start', reason: 'Δεν ήρθε κανείς' }, at(OFFICE, '2026-11-16T10:00:00.000Z'));
const resolve = (releaseMinor: number): IssuanceAction => ({ kind: 'resolve-advance-dispute', releaseMinor, reason: 'Ήρθε, αλλά δεν μέτρησε' });
const refusalOf = (record: IssuanceAssignmentRecord, action: IssuanceAction, actor: IssuanceActor) => {
  const reduced = act(record, action, actor);
  return reduced.ok ? null : reduced.refusal;
};

describe('Θ-1 — ακύρωση: η πολιτική ΤΗ ΣΤΙΓΜΗ της ακύρωσης, σε σύνολα', () => {
  it('πριν από την έναρξη ⇒ όλα πίσω, αμέσως', () => {
    const record = apply(funded(), CANCEL, at(OFFICE, WITHIN_WITHDRAWAL));
    expect(advanceSettlementDueOf(record)).toEqual({ basis: 'cancellation', refundMinor: 4_000, releaseMinor: 0, dueAt: WITHIN_WITHDRAWAL });
  });

  it('μετά την έναρξη, μέσα στις 14 ημέρες ⇒ ο μηχανικός κρατά το πολύ την αξία της αυτοψίας', () => {
    const record = apply(started(), CANCEL, at(OFFICE, WITHIN_WITHDRAWAL));
    expect(advanceSettlementDueOf(record)).toEqual({ basis: 'cancellation', refundMinor: 2_500, releaseMinor: 1_500, dueAt: WITHIN_WITHDRAWAL });
  });

  it('μετά την έναρξη, μετά τις 14 ημέρες ⇒ η πολιτική (50%)', () => {
    const record = apply(started(), CANCEL, at(OFFICE, AFTER_WITHDRAWAL));
    expect(advanceSettlementDueOf(record)).toMatchObject({ basis: 'cancellation', refundMinor: 2_000, releaseMinor: 2_000 });
  });

  it('η ακύρωση ΠΡΟΛΑΒΑΙΝΕΙ την αυτόματη αποδέσμευση — ο λόγος αλλάζει, η αποδέσμευση «παραθύρου» αρνείται', () => {
    expect(advanceSettlementDueOf(started())).toMatchObject({ basis: 'window-elapsed', refundMinor: 0, releaseMinor: 4_000 });
    const cancelled = apply(started(), CANCEL, at(OFFICE, AFTER_WITHDRAWAL));
    const lateWindowRelease: IssuanceAction = { kind: 'advance-released', amountMinor: 4_000, transferReference: 'trn_1', basis: 'window-elapsed' };
    expect(refusalOf(cancelled, lateWindowRelease, at(SYSTEM, AFTER_WITHDRAWAL))).toBe('transition-refused');
  });

  it('τα σύνολα ΔΕΝ αλλάζουν μετά από μερική επιστροφή· όταν κινηθούν όλα, τίποτα δεν οφείλεται', () => {
    const cancelled = apply(started(), CANCEL, at(OFFICE, AFTER_WITHDRAWAL));
    const refunded = apply(cancelled, { kind: 'advance-refunded', amountMinor: 2_000, reference: 'ref_1' }, at(SYSTEM, AFTER_WITHDRAWAL));
    expect(advanceSettlementDueOf(refunded)).toMatchObject({ basis: 'cancellation', refundMinor: 2_000, releaseMinor: 2_000 });
    const tooMuch: IssuanceAction = { kind: 'advance-released', amountMinor: 2_001, transferReference: 'trn_1', basis: 'cancellation' };
    expect(refusalOf(refunded, tooMuch, at(SYSTEM, AFTER_WITHDRAWAL))).toBe('transition-refused');
    const done = apply(refunded, { ...tooMuch, amountMinor: 2_000 } as IssuanceAction, at(SYSTEM, AFTER_WITHDRAWAL));
    expect(advanceSettlementDueOf(done)).toBeNull();
    expect(advanceStateOf(done)).toMatchObject({ kind: 'released', releasedMinor: 2_000, refundedMinor: 2_000 });
  });
});

describe('Θ-4/Θ-5 — διαφορά: τα χρήματα παγώνουν ως την απόφαση, και η απόφαση υπερισχύει', () => {
  it('ακύρωση σε διαφορά ⇒ καμία κίνηση (ο διάλογος λέει «παγώνουν»)', () => {
    const record = apply(disputed(), CANCEL, at(OFFICE, AFTER_WITHDRAWAL));
    expect(advanceSettlementDueOf(record)).toBeNull();
    expect(cancellationPreviewOf(disputed(), AFTER_WITHDRAWAL)).toEqual({ kind: 'frozen' });
  });

  it('απόφαση διαίρεσης ⇒ σύνολα της απόφασης, ΚΑΙ μετά από ακύρωση (όχι η πολιτική)', () => {
    const decided = apply(disputed(), resolve(1_000), at(OFFICE, AFTER_WITHDRAWAL));
    expect(advanceSettlementDueOf(decided)).toEqual({ basis: 'office-resolution', refundMinor: 3_000, releaseMinor: 1_000, dueAt: AFTER_WITHDRAWAL });
    const cancelledAfter = apply(decided, CANCEL, at(OFFICE, AFTER_WITHDRAWAL));
    expect(advanceSettlementDueOf(cancelledAfter)).toMatchObject({ basis: 'office-resolution', refundMinor: 3_000, releaseMinor: 1_000 });
  });

  it('η διαφορά επιβιώνει της ακύρωσης: το γραφείο αποφασίζει και σε ακυρωμένη ανάθεση', () => {
    const frozen = apply(disputed(), CANCEL, at(OFFICE, AFTER_WITHDRAWAL));
    const decided = apply(frozen, resolve(0), at(OFFICE, AFTER_WITHDRAWAL));
    expect(advanceSettlementDueOf(decided)).toMatchObject({ basis: 'office-resolution', refundMinor: 4_000, releaseMinor: 0 });
  });

  it('οριστική: ίδια ⇒ unchanged · άλλη ⇒ άρνηση · εκτός διαφοράς ⇒ άρνηση · μόνο το γραφείο · ποσό ως το κρατημένο · αιτιολογία', () => {
    const later = at(OFFICE, AFTER_WITHDRAWAL);
    const decided = apply(disputed(), resolve(1_000), later);
    const again = act(decided, resolve(1_000), later);
    expect(again.ok && again.changed).toBe(false);
    expect(refusalOf(decided, resolve(2_000), later)).toBe('transition-refused');
    expect(refusalOf(started(), resolve(1_000), OFFICE)).toBe('transition-refused');
    expect(refusalOf(disputed(), resolve(1_000), ENGINEER)).toBe('actor-refused');
    expect(refusalOf(disputed(), resolve(4_001), OFFICE)).toBe('terms-refused');
    expect(refusalOf(disputed(), { kind: 'resolve-advance-dispute', releaseMinor: 1_000, reason: '   ' }, OFFICE)).toBe('terms-refused');
  });
});

describe('Θ-8 — νέα πρόταση περιμένει όσο ζουν χρήματα στην ακυρωμένη ανάθεση', () => {
  const PROPOSE: IssuanceAction = { kind: 'propose', professional: { kind: 'contact', contactId: 'cont_other' }, credential: { qualification: 'energy-inspector-registered', registryNumber: 'ΥΠΕΝ-2' } };

  it('επιστροφή σε εξέλιξη ⇒ άρνηση· όταν επιστραφούν όλα ⇒ επιτρέπεται', () => {
    const cancelled = apply(funded(), CANCEL, at(OFFICE, WITHIN_WITHDRAWAL));
    expect(refusalOf(cancelled, PROPOSE, OFFICE)).toBe('transition-refused');
    const refunded = apply(cancelled, { kind: 'advance-refunded', amountMinor: 4_000, reference: 'ref_1' }, at(SYSTEM, WITHIN_WITHDRAWAL));
    expect(refusalOf(refunded, PROPOSE, OFFICE)).toBeNull();
  });
});

describe('cancellationPreviewOf — τα ποσά του διαλόγου από την ΙΔΙΑ κρίση', () => {
  it('χωρίς χρήματα ⇒ none · με χρήματα ⇒ ό,τι θα κινηθεί', () => {
    const unfunded = ASSIGNED.reduce<IssuanceAssignmentRecord | null>((current, action) => apply(current, action, OFFICE), null);
    if (unfunded === null) throw new Error('no record');
    expect(cancellationPreviewOf(unfunded, WITHIN_WITHDRAWAL)).toEqual({ kind: 'none' });
    expect(cancellationPreviewOf(started(), WITHIN_WITHDRAWAL)).toEqual({ kind: 'settle', basis: 'cancellation', refundMinor: 2_500, retainedMinor: 1_500 });
  });
});
