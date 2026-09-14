/**
 * Seeders — **συμβάντα παράδοσης email και κατάσταση ανά διεύθυνση** (ADR-841 §7 Α21.20).
 *
 * 🔑 **Χωριστό αρχείο**: δεν ανήκει σε μισθωτή ούτε στη βιτρίνα — είναι υποδομή πλατφόρμας.
 * Το seed είναι **το σχήμα που γράφει ο `email-delivery-ledger`**, τίποτα περισσότερο.
 *
 * @module tests/firestore-rules/_harness/seed-helpers-email-delivery
 */

import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { withSeedContext } from './auth-contexts';

const SEED_EMAIL = 'office@example.gr';
const SEED_DIGEST = 'a'.repeat(64);

export async function seedEmailDeliveryEvent(env: RulesTestEnvironment): Promise<string> {
  const id = `edev_mailgun_${SEED_DIGEST}`;
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('email_delivery_events').doc(id).set({
      provider: 'mailgun', providerEventId: 'seed-event', occurredAt: '2026-09-14T08:00:00.000Z',
      recipient: SEED_EMAIL, kind: 'failed', evidence: 'mailbox-absent', providerReason: 'bounce',
      smtpCode: 550, enhancedCode: '5.1.1', providerMessageId: null, purpose: null, ref: null,
      receivedAt: '2026-09-14T08:00:01.000Z', expireAt: '2027-10-19T08:00:00.000Z',
    });
  });
  return id;
}

export async function seedRecipientStanding(env: RulesTestEnvironment): Promise<string> {
  const id = `erst_${SEED_DIGEST}`;
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('email_recipient_standing').doc(id).set({
      email: SEED_EMAIL, mailboxAbsentAt: '2026-09-14T08:00:00.000Z', evidenceEventId: 'seed-event',
      lastDeliveredAt: null, lastComplainedAt: null, lastEventAt: '2026-09-14T08:00:00.000Z',
      updatedAt: '2026-09-14T08:00:01.000Z',
    });
  });
  return id;
}
