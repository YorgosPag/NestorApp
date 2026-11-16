/**
 * ADR-915 §45 Φ3 — άγκυρες των ΥΠΕΝΘΥΜΙΣΕΩΝ ΠΑΡΑΔΟΣΗΣ: πρόγραμμα (παραμονή · +1 · +5 εργάσιμες, με αργίες) · αρχή ημέρας
 * στην Ελλάδα · το πρόγραμμα ακολουθεί την προθεσμία · CAS · κενό ημέρας για τη χειροκίνητη · σειρά της κρίσης · στιγμή
 * του email. Συνθετικά δεδομένα — κανένα δεδομένο πελάτη.
 */

import {
  reduceIssuance,
  type IssuanceAction,
  type IssuanceActor,
  type IssuanceAssignmentRecord,
} from '@/lib/document-validity/issuance-assignment';
import {
  deliveryReminderDays,
  deliveryReminderMomentOf,
  deliveryReminderSchedule,
  deliveryReminderVerdict,
  ISSUANCE_DELIVERY_REMINDER_POLICY,
  lastDeliveryReminderAt,
  manualDeliveryReminderRefusal,
  withDeliveryReminderPlan,
  withDeliveryReminderSent,
  withDeliveryRemindersRetired,
  withManualDeliveryReminder,
  type IssuanceDeliveryReminders,
} from '@/lib/document-validity/issuance-delivery-reminder';
import type { QuoteTerms } from '@/lib/document-validity/issuance-quote';

const INSPECTOR = { qualification: 'energy-inspector-registered', registryNumber: 'ΥΠΕΝ-123' } as const;
const TERMS: QuoteTerms = {
  basis: 'firm', amountMinor: 10_000, vatRatePercent: 24, vatIncluded: false,
  validUntil: '2026-12-31', scope: ['issuance'], note: null, deliveryBusinessDays: 5, advance: null,
};
const PROPOSE: IssuanceAction = { kind: 'propose', professionalContactId: 'cont_pro', credential: INSPECTOR };
const NOTIFY: IssuanceAction = { kind: 'notify', channel: 'email', invitationId: null, note: null, verification: null };
const QUOTE: IssuanceAction = { kind: 'quote', terms: TERMS };
const APPROVE: IssuanceAction = { kind: 'decide', outcome: 'approved', channel: 'phone', note: null, ownerContactId: 'cont_lead', quoteRevision: 1, ownerAttestation: null };

/** Ένα βήμα ανά ημέρα από τη Δευτέρα 2026-11-02· η έγκριση (βήμα 3) την Πέμπτη 2026-11-05 ⇒ προθεσμία Πέμπτη 2026-11-12. */
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

/** Αναληφθείσα, με προγραμματισμένες υπενθυμίσεις — όπως τη γράφει ο ΕΝΑΣ γραφέας μετά την έγκριση. */
const accepted = (): IssuanceAssignmentRecord => withDeliveryReminderPlan(run([PROPOSE, NOTIFY, QUOTE, APPROVE]), at(3));

/** Μεσάνυχτα Ελλάδας (Νοέμβριος = UTC+2). */
const ATHENS_MIDNIGHT = { '2026-11-11': '2026-11-10T22:00:00.000Z', '2026-11-13': '2026-11-12T22:00:00.000Z', '2026-11-20': '2026-11-19T22:00:00.000Z' } as const;

const reminders = (over: Partial<IssuanceDeliveryReminders> = {}): IssuanceDeliveryReminders =>
  ({ forDueOn: '2026-11-12', dueAt: ATHENS_MIDNIGHT['2026-11-11'], sentAt: [], manual: [], ...over });

describe('ADR-915 §45 Φ3 — το πρόγραμμα', () => {
  it('παραμονή (προηγούμενη εργάσιμη) · +1 εργάσιμη · +5 εργάσιμες — το πολύ 3', () => {
    expect(deliveryReminderDays('2026-11-12')).toEqual(['2026-11-11', '2026-11-13', '2026-11-20']);
    expect(deliveryReminderDays('2026-11-12')).toHaveLength(ISSUANCE_DELIVERY_REMINDER_POLICY.maxAutomatic);
  });

  it('η παραμονή προσπερνά Σαββατοκύριακο: προθεσμία Δευτέρα ⇒ παραμονή Παρασκευή', () => {
    expect(deliveryReminderDays('2026-11-16')[0]).toBe('2026-11-13');
  });

  it('οι αργίες δεν μετρούν: προθεσμία Δευτέρα 28/12 ⇒ παραμονή Πέμπτη 24/12 (Χριστούγεννα · Σ/Κ) · +1 Τρίτη 29/12', () => {
    expect(deliveryReminderDays('2026-12-28').slice(0, 2)).toEqual(['2026-12-24', '2026-12-29']);
  });

  it('κάθε θέση είναι η αρχή της ημέρας ΣΤΗΝ ΕΛΛΑΔΑ, ανεξάρτητα από τη ζώνη του server', () => {
    expect(deliveryReminderSchedule('2026-11-12')).toEqual(Object.values(ATHENS_MIDNIGHT));
  });
});

describe('ADR-915 §45 Φ3 — το πρόγραμμα ακολουθεί την προθεσμία', () => {
  it('έγκριση της προσφοράς ⇒ πρόγραμμα για την προθεσμία, πρώτη θέση η παραμονή', () => {
    expect(accepted().deliveryReminders).toEqual(reminders());
  });

  it('ιδεμποτές: ίδια προθεσμία ⇒ η ΙΔΙΑ ανάθεση', () => {
    const record = accepted();
    expect(withDeliveryReminderPlan(record, at(4))).toBe(record);
  });

  it('νέα προθεσμία ⇒ νέο αυτόματο πρόγραμμα· οι χειροκίνητες μένουν (ιστορία της ανάθεσης)', () => {
    const manual = [{ at: at(4), byUid: 'uid_agent' }];
    const base = { ...accepted(), deliveryReminders: reminders({ sentAt: [at(4)], manual }) };
    const moved = reduceIssuance('energy-certificate', base, null, { kind: 'schedule-delivery', dueOn: '2026-11-19', reason: 'αυτοψία' }, office(5));
    if (!moved.ok) throw new Error(moved.refusal);
    const plan = withDeliveryReminderPlan(moved.record, at(5))?.deliveryReminders;
    expect(plan).toEqual({ forDueOn: '2026-11-19', dueAt: '2026-11-17T22:00:00.000Z', sentAt: [], manual });
  });

  it('θέσεις που πέρασαν δεν στέλνονται κατά ριπές: πρόγραμμα γραμμένο μετά την παραμονή ⇒ πρώτη η +1', () => {
    const record = withDeliveryReminderPlan(run([PROPOSE, NOTIFY, QUOTE, APPROVE]), '2026-11-11T12:00:00.000Z');
    expect(record.deliveryReminders?.dueAt).toBe(ATHENS_MIDNIGHT['2026-11-13']);
  });

  it('μη αναληφθείσα ⇒ κανένα πρόγραμμα', () => {
    const quoted = run([PROPOSE, NOTIFY, QUOTE]);
    expect(withDeliveryReminderPlan(quoted, at(3))).toBe(quoted);
  });
});

describe('ADR-915 §45 Φ3 — καταγραφή (CAS)', () => {
  it('αυτόματη έφυγε ⇒ η επόμενη από το ίδιο πρόγραμμα· άλλο `dueAt` ⇒ τίποτα', () => {
    const record = accepted();
    const sent = withDeliveryReminderSent(record, { dueAt: ATHENS_MIDNIGHT['2026-11-11'], sentAt: '2026-11-11T07:33:00.000Z' });
    expect(sent?.deliveryReminders).toEqual(reminders({ dueAt: ATHENS_MIDNIGHT['2026-11-13'], sentAt: ['2026-11-11T07:33:00.000Z'] }));
    expect(withDeliveryReminderSent(record, { dueAt: 'άλλο', sentAt: at(9) })).toBeNull();
  });

  it('μετά την τρίτη αυτόματη ⇒ καμία άλλη (`dueAt: null`)', () => {
    const record = { ...accepted(), deliveryReminders: reminders({ dueAt: ATHENS_MIDNIGHT['2026-11-20'], sentAt: [at(9), at(11)] }) };
    expect(withDeliveryReminderSent(record, { dueAt: ATHENS_MIDNIGHT['2026-11-20'], sentAt: '2026-11-20T07:33:00.000Z' })?.deliveryReminders?.dueAt).toBeNull();
  });

  it('απόσυρση ⇒ `dueAt: null` με CAS', () => {
    const record = accepted();
    expect(withDeliveryRemindersRetired(record, ATHENS_MIDNIGHT['2026-11-11'])?.deliveryReminders?.dueAt).toBeNull();
    expect(withDeliveryRemindersRetired(record, 'άλλο')).toBeNull();
  });
});

describe('ADR-915 §45 Φ3 — χειροκίνητη', () => {
  it('ποτέ δύο υπενθυμίσεις μέσα σε 24 ώρες, από όποιον δρόμο κι αν ήρθε η προηγούμενη', () => {
    const afterAuto = reminders({ sentAt: ['2026-11-11T07:33:00.000Z'] });
    expect(manualDeliveryReminderRefusal(afterAuto, '2026-11-11T15:00:00.000Z')).toBe('too-soon');
    expect(manualDeliveryReminderRefusal(afterAuto, '2026-11-12T08:00:00.000Z')).toBeNull();
  });

  it('γεμάτο ιστορικό ⇒ `limit`', () => {
    const manual = Array.from({ length: ISSUANCE_DELIVERY_REMINDER_POLICY.maxManual }, (_, i) => ({ at: `2026-01-${String(i + 1).padStart(2, '0')}T09:00:00.000Z`, byUid: 'u' }));
    expect(manualDeliveryReminderRefusal(reminders({ manual }), at(10))).toBe('limit');
  });

  it('γράφεται και σε ανάθεση χωρίς πρόγραμμα· δεύτερο πάτημα μέσα στην ημέρα ⇒ τίποτα· το αυτόματο μένει', () => {
    const bare = { ...accepted(), deliveryReminders: null };
    const once = withManualDeliveryReminder(bare, { at: at(5), byUid: 'uid_agent' });
    expect(once?.deliveryReminders).toEqual({ forDueOn: null, dueAt: null, sentAt: [], manual: [{ at: at(5), byUid: 'uid_agent' }] });
    expect(once === null ? 'null' : withManualDeliveryReminder(once, { at: at(5), byUid: 'uid_other' })).toBeNull();
    const planned = withManualDeliveryReminder(accepted(), { at: at(5), byUid: 'uid_agent' });
    expect(planned?.deliveryReminders?.dueAt).toBe(ATHENS_MIDNIGHT['2026-11-11']);
  });

  it('η «τελευταία» είναι η νεότερη από αυτόματες ΚΑΙ χειροκίνητες', () => {
    expect(lastDeliveryReminderAt(null)).toBeNull();
    expect(lastDeliveryReminderAt(reminders({ sentAt: [at(9)], manual: [{ at: at(10), byUid: 'u' }] }))).toBe(at(10));
  });
});

describe('ADR-915 §45 Φ3 — η κρίση της σάρωσης (σειρά-συμβόλαιο)', () => {
  const NOW = '2026-11-11T07:33:00.000Z';
  const base = { reminders: reminders(), open: true, dueOn: '2026-11-12', nowIso: NOW };

  it('κανένα `dueAt` ⇒ αναμονή', () => {
    expect(deliveryReminderVerdict({ ...base, reminders: reminders({ dueAt: null }) })).toEqual({ kind: 'wait' });
  });

  it('κλειστή (ολοκληρώθηκε · ακυρώθηκε) ⇒ απόσυρση, πριν από οτιδήποτε άλλο', () => {
    expect(deliveryReminderVerdict({ ...base, open: false, dueOn: '2026-11-19' })).toMatchObject({ kind: 'retire', reason: 'closed' });
  });

  it('άλλη προθεσμία από αυτή που υπηρετεί το πρόγραμμα ⇒ απόσυρση (ποτέ υπενθύμιση με παλιά ημερομηνία)', () => {
    expect(deliveryReminderVerdict({ ...base, dueOn: '2026-11-19' })).toMatchObject({ kind: 'retire', reason: 'due-changed' });
  });

  it('πρόσφατη χειροκίνητη ⇒ η αυτόματη ΜΕΤΑΤΙΘΕΤΑΙ, δεν αποσύρεται', () => {
    const recent = reminders({ manual: [{ at: '2026-11-10T15:00:00.000Z', byUid: 'u' }] });
    expect(deliveryReminderVerdict({ ...base, reminders: recent })).toEqual({ kind: 'wait' });
  });

  it('ώρα της ⇒ υπενθύμιση με την προθεσμία· πριν την ώρα ⇒ αναμονή', () => {
    expect(deliveryReminderVerdict(base)).toEqual({ kind: 'remind', dueAt: ATHENS_MIDNIGHT['2026-11-11'], dueOn: '2026-11-12' });
    expect(deliveryReminderVerdict({ ...base, nowIso: '2026-11-10T12:00:00.000Z' })).toEqual({ kind: 'wait' });
  });
});

describe('ADR-915 §45 Φ3 — η στιγμή του email (από τη ΜΙΑ βαθμίδα της Φ2)', () => {
  it('πριν · σήμερα · μετά · χωρίς προθεσμία', () => {
    expect(deliveryReminderMomentOf('2026-11-12', '2026-11-11')).toBe('upcoming');
    expect(deliveryReminderMomentOf('2026-11-30', '2026-11-11')).toBe('upcoming');
    expect(deliveryReminderMomentOf('2026-11-12', '2026-11-12')).toBe('due-today');
    expect(deliveryReminderMomentOf('2026-11-12', '2026-11-13')).toBe('overdue');
    expect(deliveryReminderMomentOf(null, '2026-11-13')).toBe('no-due-date');
  });
});
