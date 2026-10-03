/**
 * ADR-901 Φ4 §6 Σ-5 — ο πυρήνας των ειδοποιήσεων λήξεων: **ακμή, όχι στάθμη**.
 * Κάθε `it` ονομάζει τη μετάλλαξη που πρέπει να πιάσει.
 */

import { expiryAlertsOf, expiryEventId, expirySummary } from '../expiry-alerts';
import type { ChecklistRow, ChecklistRowStatus } from '@/types/conveyance-case';

function row(itemId: string, status: ChecklistRowStatus, expiresOn: string | null = null): ChecklistRow {
  return { itemId, status, expiresOn } as unknown as ChecklistRow;
}

describe('expiryAlertsOf', () => {
  it('μόνο `expiring` και `expired`, σε σταθερή σειρά ανεξάρτητα από τη σειρά του καταλόγου', () => {
    const a = expiryAlertsOf([row('z_cert', 'expired', '2026-09-30'), row('a_cert', 'expiring', '2026-10-08'), row('m', 'accepted'), row('n', 'missing')]);
    expect(a.map((x) => x.itemId)).toEqual(['a_cert', 'z_cert']);
  });
});

describe('expiryEventId — Α21', () => {
  const today = [row('cert_a', 'expiring', '2026-10-08'), row('cert_b', 'expiring', '2026-10-09')];

  it('ΙΔΙΟ σύνολο (ακόμη και σε άλλη σειρά) ⇒ ΙΔΙΟ eventId ⇒ καμία δεύτερη ειδοποίηση', () => {
    // Μετάλλαξη: eventId με ημερομηνία σάρωσης ⇒ email κάθε μέρα για το ίδιο πιστοποιητικό.
    expect(expiryEventId('cvc_1', 'u_1', expiryAlertsOf(today))).toBe(expiryEventId('cvc_1', 'u_1', expiryAlertsOf([...today].reverse())));
  });

  it('πέρασμα `expiring` → `expired` ⇒ ΝΕΟ eventId (η κατάσταση χειροτέρεψε, αξίζει να ειπωθεί)', () => {
    const tomorrow = [row('cert_a', 'expired', '2026-10-08'), row('cert_b', 'expiring', '2026-10-09')];
    expect(expiryEventId('cvc_1', 'u_1', expiryAlertsOf(tomorrow))).not.toBe(expiryEventId('cvc_1', 'u_1', expiryAlertsOf(today)));
  });

  it('νέο πιστοποιητικό με άλλη λήξη (ανανέωση που λήγει ξανά) ⇒ ΝΕΟ eventId', () => {
    // Μετάλλαξη: αποτύπωμα χωρίς `expiresOn` ⇒ η ανανέωση που επίσης δεν φτάνει δεν λέγεται ποτέ.
    const renewed = [row('cert_a', 'expiring', '2026-10-20'), row('cert_b', 'expiring', '2026-10-09')];
    expect(expiryEventId('cvc_1', 'u_1', expiryAlertsOf(renewed))).not.toBe(expiryEventId('cvc_1', 'u_1', expiryAlertsOf(today)));
  });

  it('άλλος παραλήπτης / άλλη υπόθεση ⇒ άλλο eventId (ο ένας δεν «καταναλώνει» την ειδοποίηση του άλλου)', () => {
    const alerts = expiryAlertsOf(today);
    expect(new Set([expiryEventId('cvc_1', 'u_1', alerts), expiryEventId('cvc_1', 'u_2', alerts), expiryEventId('cvc_2', 'u_1', alerts)]).size).toBe(3);
  });
});

describe('expirySummary', () => {
  it('πλήθος · πόσες έληξαν · η ΝΩΡΙΤΕΡΗ λήξη', () => {
    expect(expirySummary(expiryAlertsOf([row('a', 'expiring', '2026-10-09'), row('b', 'expired', '2026-10-01'), row('c', 'expiring', null)])))
      .toEqual({ count: 3, expired: 1, earliest: '2026-10-01' });
  });
});
