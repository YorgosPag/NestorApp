/**
 * ADR-915 §45 Φ2 — άγκυρες της ΠΡΟΘΕΣΜΙΑΣ ΠΑΡΑΔΟΣΗΣ: η προθεσμία από την έγκριση (εργάσιμες, με αργίες) · η νεότερη
 * δέσμευση κερδίζει · αλλαγή μόνο με αιτιολογία · βαθμίδες Procore · «μετά την υπογραφή» · η καρτέλα «Καθυστερούν»
 * από τον ΙΔΙΟ κριτή με το κελί. Συνθετικά δεδομένα — κανένα δεδομένο πελάτη.
 */

import {
  issuanceStageOf,
  reduceIssuance,
  type IssuanceAction,
  type IssuanceActor,
  type IssuanceAssignmentRecord,
} from '@/lib/document-validity/issuance-assignment';
import {
  deliveryDueFromApproval,
  deliveryMissesSigning,
  issuanceDeliveryOf,
  issuanceDeliveryStatusOf,
  issuanceLatenessOf,
  ISSUANCE_DELIVERY_POLICY,
} from '@/lib/document-validity/issuance-delivery-due';
import { areQuoteTermsValid, type QuoteTerms } from '@/lib/document-validity/issuance-quote';
import { registryRowIdOf } from '@/lib/document-validity/document-registry';
import { issuanceOverdueDaysOf, registryTabTally, rowsOfLateTab } from '@/lib/document-validity/document-registry-view';
import { FIXTURE_AS_OF, fixtureResponse } from './registry-fixture';

const INSPECTOR = { qualification: 'energy-inspector-registered', registryNumber: 'ΥΠΕΝ-123' } as const;
const TERMS: QuoteTerms = {
  basis: 'firm', amountMinor: 10_000, vatRatePercent: 24, vatIncluded: false,
  validUntil: '2026-12-31', scope: ['issuance'], note: null, deliveryBusinessDays: 5, advance: null,
};
const PROPOSE: IssuanceAction = { kind: 'propose', professional: { kind: 'contact', contactId: 'cont_pro' }, credential: INSPECTOR };
const NOTIFY: IssuanceAction = { kind: 'notify', channel: 'email', invitationId: null, note: null, verification: null };
const quote = (terms: QuoteTerms = TERMS): IssuanceAction => ({ kind: 'quote', terms });
const approve = (quoteRevision: number): IssuanceAction =>
  ({ kind: 'decide', outcome: 'approved', channel: 'phone', note: null, ownerContactId: 'cont_lead', quoteRevision, ownerAttestation: null });
const schedule = (dueOn: string, reason: string | null): IssuanceAction => ({ kind: 'schedule-delivery', dueOn, reason });

/** Ένα βήμα ανά ημέρα από τη Δευτέρα 2026-11-02 (11:00 ώρα Ελλάδας). */
const at = (i: number): string => `2026-11-${String(i + 2).padStart(2, '0')}T09:00:00.000Z`;
const office = (i: number): IssuanceActor => ({ kind: 'office', uid: 'uid_agent', nowIso: at(i) });

function run(actions: readonly IssuanceAction[]): IssuanceAssignmentRecord {
  let record: IssuanceAssignmentRecord | null = null;
  actions.forEach((action, i) => {
    const reduced = reduceIssuance('energy-certificate', record, null, action, office(i));
    if (!reduced.ok) throw new Error(`${action.kind}: ${reduced.refusal}`);
    record = reduced.record;
  });
  if (record === null) throw new Error('no record');
  return record;
}

/** Έγκριση την Πέμπτη 2026-11-05 (βήμα 3) ⇒ 5 εργάσιμες ⇒ Πέμπτη 2026-11-12. */
const ACCEPTED = [PROPOSE, NOTIFY, quote(), approve(1)] as const;

/** Ανάθεση σε `accepted` με προσφορά **πριν από τη Φ2** (χωρίς χρόνο) — όπως διαβάζεται από τον δίσκο. */
function legacyAccepted(): IssuanceAssignmentRecord {
  const record = run(ACCEPTED);
  if (record.quote === null) throw new Error('no quote');
  return { ...record, quote: { ...record.quote, deliveryBusinessDays: null } };
}

describe('ADR-915 §45 Φ2 — η προσφορά δεσμεύει χρόνο', () => {
  it('καμία ΝΕΑ προσφορά χωρίς χρόνο παράδοσης · εκτός εύρους 1–90 ⇒ άκυρη', () => {
    expect(areQuoteTermsValid(TERMS, '2026-11-02')).toBe(true);
    for (const days of [null, 0, 91, 2.5]) {
      expect(areQuoteTermsValid({ ...TERMS, deliveryBusinessDays: days }, '2026-11-02')).toBe(false);
    }
  });

  it('ο μειωτής αρνείται προσφορά χωρίς χρόνο (`terms-refused`)', () => {
    const record = run([PROPOSE, NOTIFY]);
    const reduced = reduceIssuance('energy-certificate', record, null, quote({ ...TERMS, deliveryBusinessDays: null }), office(2));
    expect(reduced).toEqual({ ok: false, refusal: 'terms-refused' });
  });

  it('«παράδοση σε N εργάσιμες από την έγκριση» — η ημέρα έγκρισης δεν μετρά, οι αργίες δεν μετρούν', () => {
    expect(deliveryDueFromApproval('2026-11-05', TERMS)).toBe('2026-11-12');
    // Πέμπτη 24/12 + 1 ⇒ Χριστούγεννα (Παρ.) · Σύναξη (Σάβ.) · Κυριακή ⇒ Δευτέρα 28/12.
    expect(deliveryDueFromApproval('2026-12-24', { deliveryBusinessDays: 1 })).toBe('2026-12-28');
    expect(deliveryDueFromApproval('2026-11-05', { deliveryBusinessDays: null })).toBeNull();
  });
});

describe('ADR-915 §45 Φ2 — η τρέχουσα προθεσμία (η νεότερη δέσμευση κερδίζει)', () => {
  it('έγκριση της προσφοράς ⇒ προθεσμία από την προσφορά, «από» τη στιγμή της έγκρισης', () => {
    const record = run(ACCEPTED);
    expect(issuanceStageOf(record)).toBe('accepted');
    expect(issuanceDeliveryOf(record)).toEqual({ dueOn: '2026-11-12', source: 'quote', since: at(3), reason: null });
  });

  it('πριν από την έγκριση ⇒ καμία προθεσμία (η προσφορά είναι υπόσχεση, όχι δέσμευση)', () => {
    expect(issuanceDeliveryOf(run([PROPOSE, NOTIFY, quote()]))).toBeNull();
  });

  it('αλλαγή ΧΩΡΙΣ αιτιολογία ⇒ `terms-refused` · με αιτιολογία ⇒ «άλλαξε», με ίχνος', () => {
    const record = run(ACCEPTED);
    expect(reduceIssuance('energy-certificate', record, null, schedule('2026-11-20', null), office(4))).toEqual({ ok: false, refusal: 'terms-refused' });
    const reduced = reduceIssuance('energy-certificate', record, null, schedule('2026-11-20', 'αυτοψία μετατέθηκε'), office(4));
    if (!reduced.ok) throw new Error(reduced.refusal);
    expect(reduced.record.deliverySchedule).toEqual([{ dueOn: '2026-11-20', reason: 'αυτοψία μετατέθηκε', at: at(4), byUid: 'uid_agent' }]);
    expect(issuanceDeliveryOf(reduced.record)).toEqual({ dueOn: '2026-11-20', source: 'rescheduled', since: at(4), reason: 'αυτοψία μετατέθηκε' });
  });

  it('ίδια ημερομηνία ⇒ `changed: false` (ιδεμποτές, κανένα ίχνος)', () => {
    const record = run(ACCEPTED);
    expect(reduceIssuance('energy-certificate', record, null, schedule('2026-11-12', null), office(4))).toEqual({ ok: true, record, changed: false });
  });

  it('χωρίς δέσμευση (προσφορά πριν από τη Φ2) ⇒ το γραφείο ΟΡΙΖΕΙ χωρίς αιτιολογία · η επόμενη αλλαγή τη ζητά', () => {
    const record = legacyAccepted();
    expect(issuanceDeliveryOf(record)).toBeNull();
    const set = reduceIssuance('energy-certificate', record, null, schedule('2026-11-30', null), office(4));
    if (!set.ok) throw new Error(set.refusal);
    expect(issuanceDeliveryOf(set.record)).toMatchObject({ dueOn: '2026-11-30', source: 'office' });
    expect(reduceIssuance('energy-certificate', set.record, null, schedule('2026-12-04', null), office(5))).toEqual({ ok: false, refusal: 'terms-refused' });
  });

  it('νέα έγκριση μετά από αναθεώρηση ⇒ η νέα δέσμευση της προσφοράς κερδίζει την παλιότερη αλλαγή', () => {
    const indicative: QuoteTerms = { ...TERMS, basis: 'indicative' };
    const record = run([
      PROPOSE, NOTIFY, quote(indicative), approve(1),
      schedule('2026-11-27', 'μετάθεση'),
      quote({ ...indicative, amountMinor: 12_000, deliveryBusinessDays: 10 }),
      approve(2),
    ]);
    // Έγκριση rev2 την Κυριακή 2026-11-08 (βήμα 6) + 10 εργάσιμες ⇒ Παρασκευή 2026-11-20 — νεότερη από την αλλαγή (27/11).
    expect(issuanceDeliveryOf(record)).toEqual({ dueOn: '2026-11-20', source: 'quote', since: at(6), reason: null });
  });

  it('άκυρη ημέρα ή πριν από την πρόταση ⇒ `terms-refused`', () => {
    const record = run(ACCEPTED);
    for (const dueOn of ['2026-02-30', 'not-a-day', '2026-11-01']) {
      expect(reduceIssuance('energy-certificate', record, null, schedule(dueOn, 'λόγος'), office(4))).toEqual({ ok: false, refusal: 'terms-refused' });
    }
  });

  it('γεμάτο ιστορικό ⇒ `terms-refused` (αμυντικό φρένο)', () => {
    const base = run(ACCEPTED);
    const full: IssuanceAssignmentRecord = {
      ...base,
      deliverySchedule: Array.from({ length: ISSUANCE_DELIVERY_POLICY.maxScheduleEntries }, (_, i) => ({
        dueOn: '2026-11-20', reason: 'λόγος', at: `2026-11-06T0${i % 10}:00:00.000Z`, byUid: 'uid_agent',
      })),
    };
    expect(reduceIssuance('energy-certificate', full, null, schedule('2026-12-01', 'λόγος'), office(9))).toEqual({ ok: false, refusal: 'terms-refused' });
  });

  it('μόνο από `accepted` · μόνο το γραφείο (ο σύνδεσμος ⇒ `actor-refused`)', () => {
    const quoted = run([PROPOSE, NOTIFY, quote()]);
    expect(reduceIssuance('energy-certificate', quoted, null, schedule('2026-11-20', 'λόγος'), office(3))).toEqual({ ok: false, refusal: 'transition-refused' });
    const link: IssuanceActor = { kind: 'link', invitationId: 'diin_1', verifiedBy: 'link', nowIso: at(4) };
    expect(reduceIssuance('energy-certificate', run(ACCEPTED), null, schedule('2026-11-20', 'λόγος'), link)).toEqual({ ok: false, refusal: 'actor-refused' });
  });
});

describe('ADR-915 §45 Φ2 — βαθμίδες (Procore) και «μετά την υπογραφή»', () => {
  it.each([
    ['2026-11-12', '2026-11-14', { tier: 'overdue', days: 2 }],
    ['2026-11-12', '2026-11-12', { tier: 'due-today' }],
    ['2026-11-12', '2026-11-11', { tier: 'due-soon', daysLeft: 1 }],
    ['2026-11-12', '2026-11-09', { tier: 'due-soon', daysLeft: ISSUANCE_DELIVERY_POLICY.dueSoonDays }],
    ['2026-11-12', '2026-11-08', { tier: 'on-track', daysLeft: 4 }],
    [null, '2026-11-08', { tier: 'no-due-date' }],
  ] as const)('προθεσμία %s, σήμερα %s', (dueOn, today, expected) => {
    expect(issuanceLatenessOf(dueOn, today)).toEqual(expected);
  });

  it('η παράδοση ΜΕΤΑ την υπογραφή ⇒ σύγκρουση · ίδια ημέρα ή χωρίς υπογραφή ⇒ όχι', () => {
    expect(deliveryMissesSigning('2026-12-13', '2026-11-30')).toBe(true);
    expect(deliveryMissesSigning('2026-11-30', '2026-11-30')).toBe(false);
    expect(deliveryMissesSigning('2026-12-13', null)).toBe(false);
  });

  it('η κατάσταση μετρά ΜΟΝΟ στο `accepted` — αλλού `null` (κανένας ισχυρισμός)', () => {
    const accepted = run(ACCEPTED);
    expect(issuanceDeliveryStatusOf('accepted', accepted, '2026-11-14', '2026-11-10')).toEqual({
      due: issuanceDeliveryOf(accepted), lateness: { tier: 'overdue', days: 2 }, missesSigning: true,
    });
    expect(issuanceDeliveryStatusOf('quoted', accepted, '2026-11-14', null)).toBeNull();
  });
});

describe('ADR-915 §45 Φ2 — η καρτέλα «Καθυστερούν» από τον ΙΔΙΟ κριτή', () => {
  /** Έγκριση 2026-10-01 + 5 εργάσιμες ⇒ 2026-10-08· το μητρώο λέει «σήμερα» 2026-10-15 ⇒ 7 ημέρες καθυστέρηση. */
  function acceptedOn(day: string, days: number): IssuanceAssignmentRecord {
    let record: IssuanceAssignmentRecord | null = null;
    [PROPOSE, NOTIFY, quote({ ...TERMS, validUntil: '2026-12-31', deliveryBusinessDays: days }), approve(1)].forEach((action, i) => {
      const reduced = reduceIssuance('energy-certificate', record, null, action, { kind: 'office', uid: 'uid_agent', nowIso: `${day}T0${i}:00:00.000Z` });
      if (!reduced.ok) throw new Error(`${action.kind}: ${reduced.refusal}`);
      record = reduced.record;
    });
    if (record === null) throw new Error('no record');
    return record;
  }

  it('μόνο όσες πέρασαν την προθεσμία, η πιο καθυστερημένη πρώτη · ο μετρητής = οι ίδιες γραμμές', () => {
    const registry = fixtureResponse({}, undefined, undefined, [
      { propertyId: 'p1', documentKind: 'energy-certificate', record: acceptedOn('2026-10-01', 5) },  // έως 08/10 ⇒ 7 ημ.
      { propertyId: 'p6', documentKind: 'energy-certificate', record: acceptedOn('2026-10-01', 8) },  // έως 13/10 ⇒ 2 ημ.
      { propertyId: 'p2', documentKind: 'energy-certificate', record: acceptedOn('2026-10-01', 20) }, // έως 29/10 ⇒ εντός
    ]);
    const late = rowsOfLateTab(registry.rows, registry.issuance, registry.asOf);
    expect(late.map(registryRowIdOf)).toEqual(['f-expired', 'missing:p6:energy-certificate']);
    expect(late.map((row) => issuanceOverdueDaysOf(row, registry.issuance, FIXTURE_AS_OF))).toEqual([7, 2]);
    expect(registryTabTally(registry.rows, 0, late.length).late).toBe(2);
  });
});
