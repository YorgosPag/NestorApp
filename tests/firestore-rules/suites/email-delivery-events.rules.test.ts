/**
 * Firestore Rules — συλλογή `email_delivery_events` (ADR-841 §7 Α21.20)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — γράφει **μόνο** το υπογεγραμμένο webhook.
 *
 * 🔴 **ΤΑ ΚΕΛΙΑ ΠΟΥ ΕΧΟΥΝ ΣΗΜΑΣΙΑ**:
 * - **γραφή από πελάτη** — ψεύτικο bounce = αφαίρεση του σήματος «Email επιβεβαιωμένο» **ξένης** κάρτας·
 * - **ανάγνωση** — διευθύνσεις παραληπτών όλης της πλατφόρμας.
 *
 * @since 2026-09-14 (ADR-841 §7 Α21.20)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext } from '../_harness/auth-contexts';
import { seedEmailDeliveryEvent } from '../_harness/seed-helpers-email-delivery';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'email_delivery_events')!;

describe('email_delivery_events.rules — τα συμβάντα παράδοσης τα γράφει μόνο το webhook', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε διαχειριστής μισθωτή', () => {
    it('ΔΕΝ διαβάζει συμβάντα — διευθύνσεις όλης της πλατφόρμας', async () => {
      const id = await seedEmailDeliveryEvent(env());
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection('email_delivery_events').doc(id).get());
    });

    it('🔴 ΔΕΝ γράφει ψεύτικο bounce — θα έσβηνε το σήμα ξένης κάρτας', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(
        admin.firestore().collection('email_delivery_events').doc(`edev_mailgun_${'b'.repeat(64)}`).set({
          provider: 'mailgun', recipient: 'rival@example.gr', kind: 'failed', evidence: 'mailbox-absent',
        }),
      );
    });
  });
});
