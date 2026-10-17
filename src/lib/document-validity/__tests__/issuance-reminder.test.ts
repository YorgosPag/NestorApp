/**
 * @fileoverview ADR-915 §31 — **η πολιτική των υπενθυμίσεων**, καθαρή: πρόγραμμα · έναρξη μόνο αν το μήνυμα έφυγε · CAS ·
 *   κρίση με σειρά-συμβόλαιο · ώρες γραφείου. Τα δεδομένα είναι συνθετικά.
 */

import type { IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import type { IssuanceDeliveryOutcome } from '@/lib/document-validity/issuance-delivery';
import {
  insideReminderHours,
  issuanceReminderSchedule,
  issuanceReminderVerdict,
  planIssuanceReminders,
  REMINDER_ALLOWED_AFTER,
  withIssuanceReminderSent,
  withIssuanceRemindersRetired,
  type IssuanceReminderCase,
} from '@/lib/document-validity/issuance-reminder';

const AT = '2026-10-17T09:00:00.000Z';
const EXPIRES = '2026-10-24T09:00:00.000Z';

function record(recipient: IssuanceDeliveryOutcome | null): IssuanceAssignmentRecord {
  return {
    professionalContactId: 'cont_pro', credential: { qualification: 'energy-inspector-registered', registryNumber: null },
    proposedAt: AT, proposedByUid: 'user_1',
    approvalRequest: {
      invitationId: 'diin_1', ownerContactId: 'cont_a', note: null, at: AT, byUid: 'user_1', verification: 'access-code',
      delivery: recipient === null ? null : { recipient, coOwners: {} }, reminders: null,
    },
    decision: null, notice: null, response: null, cancellation: null,
  };
}

describe('ADR-915 §31 — το πρόγραμμα', () => {
  it('72 ώρες μετά και 24 ώρες πριν τη λήξη (σύνδεσμος 7 ημερών)', () => {
    expect(issuanceReminderSchedule(AT, EXPIRES)).toEqual(['2026-10-20T09:00:00.000Z', '2026-10-23T09:00:00.000Z']);
  });

  it('σύνδεσμος που ζει λίγο ⇒ ποτέ δύο μέσα στην ίδια ημέρα, ποτέ για σύνδεσμο που λήγει σε ώρες', () => {
    expect(issuanceReminderSchedule(AT, '2026-10-20T20:00:00.000Z')).toEqual(['2026-10-20T09:00:00.000Z']);
    // 74 ώρες: η «72 ωρών» θα έμενε με 2 ώρες ζωής ⇒ πέφτει· μένει η «παραμονή της λήξης».
    expect(issuanceReminderSchedule(AT, '2026-10-20T11:00:00.000Z')).toEqual(['2026-10-19T11:00:00.000Z']);
    // 30 ώρες: καμία δεν απέχει 24 ώρες από την αποστολή ⇒ καμία.
    expect(issuanceReminderSchedule(AT, '2026-10-18T15:00:00.000Z')).toEqual([]);
  });
});

describe('ADR-915 §31 — η έναρξη και η πρόοδος (CAS)', () => {
  it('🔴 μόνο αν ο αποστολέας λέει ότι το μήνυμα έφυγε — και ΜΙΑ φορά', () => {
    expect(planIssuanceReminders(record(null), 'diin_1', EXPIRES)).toBeNull();
    for (const outcome of ['failed', 'unaddressable', 'bounced', 'complained'] as const) {
      expect(planIssuanceReminders(record(outcome), 'diin_1', EXPIRES)).toBeNull();
    }
    const planned = planIssuanceReminders(record('accepted'), 'diin_1', EXPIRES);
    expect(planned?.approvalRequest?.reminders).toEqual({ dueAt: '2026-10-20T09:00:00.000Z', sentAt: [] });
    expect(planned === null ? 'none' : planIssuanceReminders(planned, 'diin_1', EXPIRES)).toBeNull();
  });

  it('μόνο στο μήνυμα που τη γέννησε — ξένο `invitationId` ⇒ τίποτα', () => {
    expect(planIssuanceReminders(record('accepted'), 'diin_other', EXPIRES)).toBeNull();
  });

  it('έφυγε ⇒ η επόμενη από το ΙΔΙΟ πρόγραμμα· παλιό `dueAt` ⇒ καμία εγγραφή', () => {
    const planned = planIssuanceReminders(record('accepted'), 'diin_1', EXPIRES);
    if (planned === null) throw new Error('not planned');
    const first = withIssuanceReminderSent(planned, 'diin_1', { dueAt: '2026-10-20T09:00:00.000Z', sentAt: '2026-10-20T10:00:00.000Z', expiresAt: EXPIRES });
    expect(first?.approvalRequest?.reminders).toEqual({ dueAt: '2026-10-23T09:00:00.000Z', sentAt: ['2026-10-20T10:00:00.000Z'] });
    expect(first === null ? 'none' : withIssuanceReminderSent(first, 'diin_1', { dueAt: '2026-10-20T09:00:00.000Z', sentAt: 'x', expiresAt: EXPIRES })).toBeNull();
    const last = first === null ? null : withIssuanceReminderSent(first, 'diin_1', { dueAt: '2026-10-23T09:00:00.000Z', sentAt: '2026-10-23T10:00:00.000Z', expiresAt: EXPIRES });
    expect(last?.approvalRequest?.reminders?.dueAt).toBeNull();
    expect(last?.approvalRequest?.delivery).toEqual({ recipient: 'accepted', coOwners: {} });
  });

  it('απόσυρση: μόνο το `dueAt` που κρίθηκε· οι υπενθυμίσεις που έφυγαν μένουν στο ιστορικό', () => {
    const planned = planIssuanceReminders(record('accepted'), 'diin_1', EXPIRES);
    if (planned === null) throw new Error('not planned');
    expect(withIssuanceRemindersRetired(planned, 'diin_1', 'stale')).toBeNull();
    expect(withIssuanceRemindersRetired(planned, 'diin_1', '2026-10-20T09:00:00.000Z')?.approvalRequest?.reminders).toEqual({ dueAt: null, sentAt: [] });
  });
});

describe('ADR-915 §31 — η κρίση', () => {
  const due = { dueAt: '2026-10-20T09:00:00.000Z', sentAt: [] };
  const base: IssuanceReminderCase = {
    reminders: due, delivery: { recipient: 'delivered', coOwners: {} }, linkOpen: true, expiresAt: EXPIRES, nowIso: '2026-10-20T10:00:00.000Z',
  };

  it('οφείλεται ⇒ remind· νωρίς ⇒ wait· χωρίς πρόγραμμα ⇒ wait', () => {
    expect(issuanceReminderVerdict(base)).toEqual({ kind: 'remind', dueAt: due.dueAt });
    expect(issuanceReminderVerdict({ ...base, nowIso: '2026-10-19T10:00:00.000Z' })).toEqual({ kind: 'wait' });
    expect(issuanceReminderVerdict({ ...base, reminders: null })).toEqual({ kind: 'wait' });
  });

  it('η σειρά είναι συμβόλαιο: κλειστός σύνδεσμος → παράδοση → λήξη', () => {
    expect(issuanceReminderVerdict({ ...base, linkOpen: false, delivery: null })).toMatchObject({ kind: 'retire', reason: 'link-closed' });
    expect(issuanceReminderVerdict({ ...base, delivery: { recipient: 'bounced', coOwners: {} } })).toMatchObject({ kind: 'retire', reason: 'delivery' });
    expect(issuanceReminderVerdict({ ...base, delivery: { recipient: 'complained', coOwners: {} } })).toMatchObject({ kind: 'retire', reason: 'delivery' });
    expect(issuanceReminderVerdict({ ...base, expiresAt: '2026-10-20T12:00:00.000Z' })).toMatchObject({ kind: 'retire', reason: 'expiring' });
  });

  it('επιτρέπεται μόνο μετά από ό,τι έφυγε ΚΑΙ δεν απορρίφθηκε', () => {
    expect(Object.entries(REMINDER_ALLOWED_AFTER).filter(([, allowed]) => allowed).map(([outcome]) => outcome).sort()).toEqual(['accepted', 'delivered']);
  });
});

describe('ADR-915 §31 — ώρες γραφείου', () => {
  it('Δευτέρα–Παρασκευή, 09:00 έως πριν τις 19:00', () => {
    expect(insideReminderHours({ weekday: 1, hour: 9 })).toBe(true);
    expect(insideReminderHours({ weekday: 5, hour: 18 })).toBe(true);
    expect(insideReminderHours({ weekday: 5, hour: 19 })).toBe(false);
    expect(insideReminderHours({ weekday: 3, hour: 8 })).toBe(false);
    expect(insideReminderHours({ weekday: 6, hour: 12 })).toBe(false);
    expect(insideReminderHours({ weekday: 0, hour: 12 })).toBe(false);
  });
});
