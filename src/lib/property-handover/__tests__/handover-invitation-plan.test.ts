/**
 * ADR-916 §7 Β1–Β10 — η κρίση «τι χρωστάμε στον αγοραστή ως πρόσκληση» (Φ-Β).
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | αγνοείται ο `recipient` | Β1 «αποδέχτηκε ⇒ ποτέ ξανά» ⇒ 🔴 |
 * | ακύρωση ⇒ `none` | Β2 «ο σύνδεσμος πεθαίνει» ⇒ 🔴 |
 * | αγνοείται το `declinedAt` | Β6 «καμία νέα στο ίδιο email» ⇒ 🔴 |
 * | το email συγκρίνεται με το αρχικό της επαφής | Β5 «άλλαξε email ⇒ νέα» ⇒ 🔴 |
 * | υπενθύμιση πριν τις 7 ημέρες | Β9 ⇒ 🔴 |
 */

import { HANDOVER_INVITATION_DELIVERY_CAP } from '@/config/property-handover-invitation-policy';
import type { PropertyHandover, PropertyHandoverInvitationLink } from '@/types/property-handover';

import { handoverInvitationFollowUpOf, handoverInvitationIntentOf } from '../handover-invitation-plan';

const ISSUED_AT = '2026-10-01T09:00:00.000Z';
const EMAIL = 'anna@example.test';

function handover(overrides: Partial<PropertyHandover> = {}): PropertyHandover {
  return {
    id: 'phov_1', companyId: 'comp_1', propertyId: 'prop_1', recipientContactId: 'cont_anna',
    lifecycle: 'awaiting-completion', completion: null, recipient: null, invitation: null,
    createdAt: ISSUED_AT, updatedAt: ISSUED_AT,
    ...overrides,
  };
}

function issued(overrides: Partial<Extract<PropertyHandoverInvitationLink, { status: 'issued' }>> = {}): PropertyHandoverInvitationLink {
  return {
    status: 'issued', invitationId: 'phin_1', inviteeEmail: EMAIL, occasion: 'reservation', issuedAt: ISSUED_AT,
    expiresAt: '2026-10-31T09:00:00.000Z', delivery: 'accepted', deliveryAttempts: 1, remindedAt: null, declinedAt: null,
    ...overrides,
  };
}

const RECIPIENT = { userId: 'uid_anna', acceptedAt: ISSUED_AT, dossierId: 'pdos_1' };

describe('handoverInvitationIntentOf — μέσα στη συναλλαγή', () => {
  it('Β1 — αποδέχτηκε ⇒ τίποτα, ΠΟΤΕ ξανά (ούτε στην ολοκλήρωση, ούτε σε αλλαγή email)', () => {
    expect(handoverInvitationIntentOf(handover({ recipient: RECIPIENT, lifecycle: 'ready', invitation: issued() }), 'new@example.test'))
      .toEqual({ kind: 'none' });
  });

  it('Β2 — ακύρωση με εκδομένη πρόσκληση ⇒ ανάκληση (ο σύνδεσμος στα εισερχόμενα πεθαίνει)', () => {
    expect(handoverInvitationIntentOf(handover({ lifecycle: 'cancelled', invitation: issued() }), EMAIL)).toEqual({ kind: 'revoke' });
  });

  it('Β2β — ακύρωση χωρίς πρόσκληση ⇒ τίποτα (ιδεμπότητα: δεύτερη συμφιλίωση δεν ξαναγράφει)', () => {
    expect(handoverInvitationIntentOf(handover({ lifecycle: 'cancelled' }), EMAIL)).toEqual({ kind: 'none' });
  });

  it('Β3 — χωρίς email ⇒ σήμα `no-address`, και μία μόνο φορά', () => {
    expect(handoverInvitationIntentOf(handover(), null)).toEqual({ kind: 'no-address' });
    expect(handoverInvitationIntentOf(handover({ invitation: { status: 'no-address', checkedAt: ISSUED_AT } }), null)).toEqual({ kind: 'none' });
  });

  it('Β4 — κράτηση με email ⇒ πρόσκληση «κράτησης»· ήρθε email μετά από `no-address` ⇒ πρόσκληση', () => {
    expect(handoverInvitationIntentOf(handover(), EMAIL)).toEqual({ kind: 'issue', email: EMAIL, occasion: 'reservation' });
    expect(handoverInvitationIntentOf(handover({ invitation: { status: 'no-address', checkedAt: ISSUED_AT } }), EMAIL))
      .toEqual({ kind: 'issue', email: EMAIL, occasion: 'reservation' });
  });

  it('Β5 — άλλαξε το email της επαφής ⇒ ΝΕΑ πρόσκληση (η παλιά ανακαλείται) — ακόμη κι αν είχε αρνηθεί η παλιά', () => {
    expect(handoverInvitationIntentOf(handover({ invitation: issued({ declinedAt: ISSUED_AT }) }), 'new@example.test'))
      .toEqual({ kind: 'issue', email: 'new@example.test', occasion: 'reservation' });
  });

  it('Β6 — αρνήθηκε ⇒ ΚΑΜΙΑ αυτόματη νέα στο ίδιο email, ούτε στην ολοκλήρωση', () => {
    expect(handoverInvitationIntentOf(handover({ lifecycle: 'ready', invitation: issued({ declinedAt: ISSUED_AT }) }), EMAIL))
      .toEqual({ kind: 'none' });
  });

  it('Β7 — ολοκλήρωση χωρίς αποδοχή ⇒ νέα πρόσκληση «ο φάκελος είναι έτοιμος»· δεύτερη φορά ⇒ τίποτα', () => {
    expect(handoverInvitationIntentOf(handover({ lifecycle: 'ready', invitation: issued() }), EMAIL))
      .toEqual({ kind: 'issue', email: EMAIL, occasion: 'completion' });
    expect(handoverInvitationIntentOf(handover({ lifecycle: 'ready', invitation: issued({ occasion: 'completion' }) }), EMAIL))
      .toEqual({ kind: 'none' });
  });

  it('Β8 — ιδεμπότητα: ίδια αλήθεια ⇒ καμία πράξη', () => {
    expect(handoverInvitationIntentOf(handover({ invitation: issued() }), EMAIL)).toEqual({ kind: 'none' });
  });
});

describe('handoverInvitationFollowUpOf — το δίχτυ των email', () => {
  const DAY_3 = '2026-10-04T09:00:00.000Z';
  const DAY_8 = '2026-10-09T09:00:00.000Z';

  it('Β9 — η υπενθύμιση φεύγει από την 7η ημέρα, μία φορά', () => {
    expect(handoverInvitationFollowUpOf(handover({ invitation: issued() }), DAY_3)).toBe('none');
    expect(handoverInvitationFollowUpOf(handover({ invitation: issued() }), DAY_8)).toBe('remind');
    expect(handoverInvitationFollowUpOf(handover({ invitation: issued({ remindedAt: DAY_8 }) }), DAY_8)).toBe('none');
  });

  it('Β10 — email που δεν έγινε δεκτό ⇒ επανάληψη· αν οφείλεται και η υπενθύμιση, φεύγει ΩΣ υπενθύμιση', () => {
    expect(handoverInvitationFollowUpOf(handover({ invitation: issued({ delivery: 'failed' }) }), DAY_3)).toBe('redeliver');
    expect(handoverInvitationFollowUpOf(handover({ invitation: issued({ delivery: 'pending', deliveryAttempts: 0 }) }), DAY_3)).toBe('redeliver');
    expect(handoverInvitationFollowUpOf(handover({ invitation: issued({ delivery: 'failed' }) }), DAY_8)).toBe('remind');
  });

  it.each([
    ['αποδεκτή', handover({ recipient: RECIPIENT, invitation: issued({ delivery: 'failed' }) })],
    ['ακυρωμένη πώληση', handover({ lifecycle: 'cancelled', invitation: issued({ delivery: 'failed' }) })],
    ['αρνήθηκε', handover({ invitation: issued({ delivery: 'failed', declinedAt: '2026-10-02T09:00:00.000Z' }) })],
    ['ληγμένη', handover({ invitation: issued({ delivery: 'failed', expiresAt: '2026-10-03T09:00:00.000Z' }) })],
    ['εξαντλημένο όριο', handover({ invitation: issued({ delivery: 'failed', deliveryAttempts: HANDOVER_INVITATION_DELIVERY_CAP }) })],
    ['χωρίς email', handover({ invitation: { status: 'no-address', checkedAt: ISSUED_AT } })],
  ])('%s ⇒ κανένα email', (_case, subject) => {
    expect(handoverInvitationFollowUpOf(subject, DAY_8)).toBe('none');
  });
});
