/**
 * ADR-915 §45.20 Φ6γ — άγκυρες του «Αίτημα νέας ημερομηνίας»: **αίτημα, όχι αλλαγή** (Procore/ACC) · μόνο ο
 * επαγγελματίας ζητά, μόνο το γραφείο απαντά · ένα εκκρεμές τη φορά · απόρριψη με αιτιολογία · η αποδοχή είναι η ίδια
 * η `schedule-delivery` · ιδεμποτία · η όψη του επαγγελματία βλέπει μόνο τη δική του συμμετοχή. Συνθετικά δεδομένα.
 */

import {
  reduceIssuance,
  type IssuanceAction,
  type IssuanceActor,
  type IssuanceAssignmentRecord,
  type IssuanceReduction,
} from '@/lib/document-validity/issuance-assignment';
import {
  deliveryChangeGlanceOf,
  deliveryChangeTransitionAt,
  pendingDeliveryChangeOf,
} from '@/lib/document-validity/issuance-delivery-change';
import { issuanceDeliveryOf, issuanceLatenessOf, latenessDayCount } from '@/lib/document-validity/issuance-delivery-due';
import type { QuoteTerms } from '@/lib/document-validity/issuance-quote';

const TERMS: QuoteTerms = {
  basis: 'firm', amountMinor: 10_000, vatRatePercent: 24, vatIncluded: false,
  validUntil: '2026-12-31', scope: ['issuance'], note: null, deliveryBusinessDays: 5, advance: null,
};
const SETUP: readonly IssuanceAction[] = [
  { kind: 'propose', professional: { kind: 'contact', contactId: 'cont_pro' }, credential: { qualification: 'energy-inspector-registered', registryNumber: 'ΥΠΕΝ-1' } },
  { kind: 'notify', channel: 'email', invitationId: null, note: null, verification: null },
  { kind: 'quote', terms: TERMS },
  { kind: 'decide', outcome: 'approved', channel: 'phone', note: null, ownerContactId: 'cont_lead', quoteRevision: 1, ownerAttestation: null },
];

/** Ένα βήμα ανά ημέρα από 2026-11-02· έγκριση 2026-11-05 + 5 εργάσιμες ⇒ προθεσμία 2026-11-12. */
const at = (day: number): string => `2026-11-${String(day).padStart(2, '0')}T09:00:00.000Z`;
const office = (day: number): IssuanceActor => ({ kind: 'office', uid: 'uid_agent', nowIso: at(day) });
const engagement = (day: number, engagementId = 'eng_1'): IssuanceActor => ({ kind: 'engagement', engagementId, uid: 'uid_pro', nowIso: at(day) });

const REQUEST = (dueOn: string, reason = 'Καθυστέρηση πρόσβασης στο ακίνητο'): IssuanceAction => ({ kind: 'request-delivery-change', dueOn, reason });
const DECLINE = (reason: string): IssuanceAction => ({ kind: 'decline-delivery-change', reason });
const SCHEDULE = (dueOn: string, reason: string | null): IssuanceAction => ({ kind: 'schedule-delivery', dueOn, reason });

function reduce(record: IssuanceAssignmentRecord, action: IssuanceAction, actor: IssuanceActor): IssuanceReduction {
  return reduceIssuance('energy-certificate', record, null, action, actor);
}

function ok(reduction: IssuanceReduction): IssuanceAssignmentRecord {
  if (!reduction.ok) throw new Error(reduction.refusal);
  return reduction.record;
}

function accepted(): IssuanceAssignmentRecord {
  let record: IssuanceAssignmentRecord | null = null;
  SETUP.forEach((action, i) => {
    const reduced = reduceIssuance('energy-certificate', record, null, action, office(i + 2));
    if (!reduced.ok) throw new Error(`${action.kind}: ${reduced.refusal}`);
    record = reduced.record;
  });
  if (record === null) throw new Error('no record');
  return record;
}

describe('ADR-915 §45.20 Φ6γ — ποιος μπορεί τι', () => {
  it('η προθεσμία του fixture είναι 2026-11-12 (βάση όλων των παρακάτω)', () => {
    expect(issuanceDeliveryOf(accepted())?.dueOn).toBe('2026-11-12');
  });

  it('μόνο η συμμετοχή ζητά — γραφείο και σύνδεσμος ⇒ actor-refused', () => {
    const record = accepted();
    expect(reduce(record, REQUEST('2026-11-20'), office(10))).toEqual({ ok: false, refusal: 'actor-refused' });
    const link: IssuanceActor = { kind: 'link', invitationId: 'diin_1', verifiedBy: 'link', nowIso: at(10) };
    expect(reduce(record, REQUEST('2026-11-20'), link)).toEqual({ ok: false, refusal: 'actor-refused' });
  });

  it('🔴 η συμμετοχή ΔΕΝ κάνει καμία άλλη πράξη — ούτε απόρριψη ούτε αλλαγή προθεσμίας', () => {
    const pending = ok(reduce(accepted(), REQUEST('2026-11-20'), engagement(10)));
    expect(reduce(pending, DECLINE('όχι'), engagement(11))).toEqual({ ok: false, refusal: 'actor-refused' });
    expect(reduce(pending, SCHEDULE('2026-11-20', 'μόνος μου'), engagement(11))).toEqual({ ok: false, refusal: 'actor-refused' });
  });
});

describe('ADR-915 §45.20 Φ6γ — το αίτημα', () => {
  it('καταγράφεται ως εκκρεμές, χωρίς να αλλάξει την προθεσμία (αίτημα, όχι αλλαγή)', () => {
    const record = ok(reduce(accepted(), REQUEST('2026-11-20'), engagement(10)));
    expect(pendingDeliveryChangeOf(record)).toMatchObject({ dueOn: '2026-11-20', engagementId: 'eng_1', byUid: 'uid_pro', answer: null });
    expect(issuanceDeliveryOf(record)?.dueOn).toBe('2026-11-12');
    expect(deliveryChangeTransitionAt(record, at(10))).toMatchObject({ kind: 'requested' });
  });

  it.each([
    ['παρελθούσα ημερομηνία', REQUEST('2026-11-09')],
    ['ίδια με την τρέχουσα', REQUEST('2026-11-12')],
    ['άκυρη ημερομηνία', REQUEST('2026-13-40')],
    ['κενή αιτιολογία', REQUEST('2026-11-20', '   ')],
    ['αιτιολογία πάνω από το όριο', REQUEST('2026-11-20', 'α'.repeat(501))],
  ])('%s ⇒ terms-refused', (_label, action) => {
    expect(reduce(accepted(), action, engagement(10))).toEqual({ ok: false, refusal: 'terms-refused' });
  });

  it('🔴 ένα εκκρεμές τη φορά — δεύτερο, διαφορετικό αίτημα ⇒ transition-refused', () => {
    const pending = ok(reduce(accepted(), REQUEST('2026-11-20'), engagement(10)));
    expect(reduce(pending, REQUEST('2026-11-25'), engagement(11))).toEqual({ ok: false, refusal: 'transition-refused' });
  });

  it('ιδεμποτία — το ΙΔΙΟ αίτημα ξανά ⇒ ok, changed: false, καμία νέα εγγραφή', () => {
    const pending = ok(reduce(accepted(), REQUEST('2026-11-20'), engagement(10)));
    const again = reduce(pending, REQUEST('2026-11-20'), engagement(11));
    expect(again).toMatchObject({ ok: true, changed: false });
    expect(ok(again).deliveryChangeRequests).toHaveLength(1);
  });
});

describe('ADR-915 §45.20 Φ6γ — η απάντηση του γραφείου', () => {
  it('απόρριψη με αιτιολογία ⇒ declined, η προθεσμία μένει', () => {
    const pending = ok(reduce(accepted(), REQUEST('2026-11-20'), engagement(10)));
    const declined = ok(reduce(pending, DECLINE('Ο ιδιοκτήτης χρειάζεται το ΠΕΑ για την υπογραφή'), office(11)));
    expect(declined.deliveryChangeRequests[0]?.answer).toMatchObject({ outcome: 'declined', dueOn: null, at: at(11) });
    expect(issuanceDeliveryOf(declined)?.dueOn).toBe('2026-11-12');
    expect(pendingDeliveryChangeOf(declined)).toBeNull();
    expect(deliveryChangeTransitionAt(declined, at(11))).toMatchObject({ kind: 'answered' });
  });

  it('απόρριψη χωρίς αιτιολογία ⇒ terms-refused · χωρίς εκκρεμές ⇒ transition-refused', () => {
    const pending = ok(reduce(accepted(), REQUEST('2026-11-20'), engagement(10)));
    expect(reduce(pending, DECLINE('  '), office(11))).toEqual({ ok: false, refusal: 'terms-refused' });
    expect(reduce(accepted(), DECLINE('όχι'), office(11))).toEqual({ ok: false, refusal: 'transition-refused' });
  });

  it('🔴 αποδοχή = η ίδια `schedule-delivery` — μπορεί και ΑΛΛΗ ημερομηνία από τη ζητούμενη (Procore)', () => {
    const pending = ok(reduce(accepted(), REQUEST('2026-11-20'), engagement(10)));
    const answered = ok(reduce(pending, SCHEDULE('2026-11-18', 'Συμφωνήθηκε τηλεφωνικά'), office(11)));
    expect(issuanceDeliveryOf(answered)?.dueOn).toBe('2026-11-18');
    expect(answered.deliveryChangeRequests[0]?.answer).toMatchObject({ outcome: 'accepted', dueOn: '2026-11-18', reason: 'Συμφωνήθηκε τηλεφωνικά' });
  });

  it('μετά την απάντηση ⇒ νέο αίτημα επιτρέπεται (το «ένα» αφορά μόνο το εκκρεμές)', () => {
    const pending = ok(reduce(accepted(), REQUEST('2026-11-20'), engagement(10)));
    const declined = ok(reduce(pending, DECLINE('όχι ακόμη'), office(11)));
    expect(reduce(declined, REQUEST('2026-11-19'), engagement(12))).toMatchObject({ ok: true, changed: true });
  });
});

describe('ADR-915 §45.20 Φ6γ — η όψη του επαγγελματία (`deliveryChangeGlanceOf`)', () => {
  it('χωρίς αιτήματα ⇒ τίποτα εκκρεμές, καμία απάντηση', () => {
    expect(deliveryChangeGlanceOf(accepted(), 'eng_1')).toEqual({ pending: null, lastAnswer: null });
  });

  it('εκκρεμές ⇒ ημέρα + αιτιολογία + πότε — 🔒 Ε-9′: ΚΑΝΕΝΑ uid', () => {
    const pending = ok(reduce(accepted(), REQUEST('2026-11-20', 'Αργεί ο φάκελος'), engagement(10)));
    const glance = deliveryChangeGlanceOf(pending, 'eng_1');
    expect(glance).toEqual({ pending: { dueOn: '2026-11-20', reason: 'Αργεί ο φάκελος', at: at(10) }, lastAnswer: null });
    expect(JSON.stringify(glance)).not.toContain('uid_');
  });

  it('απαντημένο ⇒ η ζητούμενη, η έκβαση και η ημέρα που όρισε το γραφείο', () => {
    const pending = ok(reduce(accepted(), REQUEST('2026-11-20'), engagement(10)));
    const answered = ok(reduce(pending, SCHEDULE('2026-11-18', 'Τηλεφωνικά'), office(11)));
    expect(deliveryChangeGlanceOf(answered, 'eng_1')).toEqual({
      pending: null,
      lastAnswer: { requestedDueOn: '2026-11-20', outcome: 'accepted', dueOn: '2026-11-18', reason: 'Τηλεφωνικά', at: at(11) },
    });
    expect(JSON.stringify(deliveryChangeGlanceOf(answered, 'eng_1'))).not.toContain('uid_');
  });

  it('🔴 μόνο η ΔΙΚΗ του συμμετοχή — αίτημα άλλης συμμετοχής δεν φαίνεται', () => {
    const other = ok(reduce(accepted(), REQUEST('2026-11-20'), engagement(10, 'eng_old')));
    expect(deliveryChangeGlanceOf(other, 'eng_1')).toEqual({ pending: null, lastAnswer: null });
  });
});

describe('ADR-915 §45.20 — `latenessDayCount`: ο ένας αριθμός της βαθμίδας', () => {
  it.each([
    ['2026-11-12', '2026-11-15', 3],
    ['2026-11-12', '2026-11-12', null],
    ['2026-11-12', '2026-11-10', 2],
    ['2026-11-30', '2026-11-16', 14],
    [null, '2026-11-16', null],
  ])('προθεσμία %s, σήμερα %s ⇒ %s', (dueOn, today, expected) => {
    expect(latenessDayCount(issuanceLatenessOf(dueOn, today))).toBe(expected);
  });

  it('🔴 και το «εντός» έχει αριθμό (ήταν «εντός προθεσμίας» χωρίς ημέρες)', () => {
    const lateness = issuanceLatenessOf('2026-11-30', '2026-11-16');
    expect(lateness.tier).toBe('on-track');
    expect(latenessDayCount(lateness)).toBe(14);
  });
});
