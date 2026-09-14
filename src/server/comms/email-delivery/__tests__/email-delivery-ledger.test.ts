/**
 * @jest-environment node
 *
 * @fileoverview Το ημερολόγιο συμβάντων παράδοσης — **ρώτα τον δίσκο** (ADR-841 §7 Α21.20).
 *   • Η1 καταγραφή: συμβάν + κατάσταση μαζί · Η2 🔴 επανάληψη παρόχου = καμία εγγραφή ·
 *   • Η3 αναγνώστης: κανονικοποίηση + άγνωστη διεύθυνση · Η4 νεότερη παράδοση θεραπεύει
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import type { EmailDeliveryEvent } from '@/types/email-delivery';

import { isStandingEvidence, mailboxAbsentSince } from '@/lib/communications/email-delivery/recipient-standing';
import { readRecipientStandings, recordEmailDeliveryEvent } from '../email-delivery-ledger';

jest.mock('server-only', () => ({}));

const RECEIVED = '2026-09-14T10:00:00.000Z';

function event(overrides: Partial<EmailDeliveryEvent>): EmailDeliveryEvent {
  return {
    provider: 'mailgun', providerEventId: 'evt-bounce', occurredAt: '2026-09-14T09:00:00.000Z',
    recipient: 'office@vafes.gr', kind: 'failed', evidence: 'mailbox-absent', providerReason: 'bounce',
    smtpCode: 550, enhancedCode: '5.1.1', providerMessageId: null, purpose: null, ref: null, ...overrides,
  };
}

function given(): { fake: FakeFirestore; admin: AdminFirestore } {
  const fake = new FakeFirestore();
  return { fake, admin: fake as unknown as AdminFirestore };
}

describe('email-delivery-ledger', () => {
  it('Η1 — συμβάν και κατάσταση γράφονται μαζί · η απόδειξη ισχύει', async () => {
    const { fake, admin } = given();

    const record = await recordEmailDeliveryEvent(admin, event({}), RECEIVED);

    expect(record.outcome).toBe('recorded');
    expect(record.becameAbsent).toBe(true);
    expect(isStandingEvidence(record.standing, 'evt-bounce')).toBe(true);
    expect(fake.all(COLLECTIONS.EMAIL_DELIVERY_EVENTS)).toHaveLength(1);
    expect(fake.all<Record<string, unknown>>(COLLECTIONS.EMAIL_RECIPIENT_STANDING)[0])
      .toMatchObject({ email: 'office@vafes.gr', mailboxAbsentAt: '2026-09-14T09:00:00.000Z', updatedAt: RECEIVED });
  });

  it('🔴 Η2 — ο πάροχος ξαναστέλνει: διπλό, ΚΑΜΙΑ εγγραφή, αλλά η απόδειξη ισχύει ακόμη (οι καταναλωτές ξανατρέχουν)', async () => {
    const { fake, admin } = given();
    await recordEmailDeliveryEvent(admin, event({}), RECEIVED);
    const writesAfterFirst = fake.writes;

    const again = await recordEmailDeliveryEvent(admin, event({}), '2026-09-14T11:00:00.000Z');

    expect(again.outcome).toBe('duplicate');
    expect(again.becameAbsent).toBe(false);
    expect(fake.writes).toBe(writesAfterFirst);
    expect(isStandingEvidence(again.standing, 'evt-bounce')).toBe(true);
  });

  it('Η3 — ο αναγνώστης κανονικοποιεί · άγνωστη διεύθυνση ⇒ κενή κατάσταση, ποτέ «νεκρό»', async () => {
    const { admin } = given();
    await recordEmailDeliveryEvent(admin, event({}), RECEIVED);

    const standings = await readRecipientStandings(admin, ['OFFICE@vafes.gr', 'other@vafes.gr', 'όχι-email']);

    expect(mailboxAbsentSince(standings.get('office@vafes.gr') ?? null)).toBe('2026-09-14T09:00:00.000Z');
    expect(mailboxAbsentSince(standings.get('other@vafes.gr') ?? null)).toBeNull();
    expect(standings.size).toBe(2);
  });

  it('Η4 — νεότερη παράδοση: η παλιά απόδειξη παύει να ισχύει', async () => {
    const { admin } = given();
    await recordEmailDeliveryEvent(admin, event({}), RECEIVED);

    const healed = await recordEmailDeliveryEvent(
      admin, event({ providerEventId: 'evt-delivered', kind: 'delivered', evidence: null, occurredAt: '2026-09-15T09:00:00.000Z' }), RECEIVED,
    );

    expect(mailboxAbsentSince(healed.standing)).toBeNull();
    expect(isStandingEvidence(healed.standing, 'evt-bounce')).toBe(false);
  });
});
