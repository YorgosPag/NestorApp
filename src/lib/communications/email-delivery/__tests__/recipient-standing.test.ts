/**
 * @jest-environment node
 *
 * @fileoverview Η κατάσταση μιας διεύθυνσης — αναδίπλωση **εκτός σειράς** (ADR-841 §7 Α21.20).
 *   • Σ1 απόδειξη · Σ2 μη-απόδειξη · Σ3 εκτός σειράς · Σ4 αυτοθεραπεία · Σ5 ιδεμποτένεια · Σ6 complaint
 */

import type { EmailDeliveryEvent, EmailFailureEvidence } from '@/types/email-delivery';

import { becameAbsent, emptyStanding, foldStanding, mailboxAbsentSince } from '../recipient-standing';

const EMAIL = 'office@vafes.gr';

function event(kind: EmailDeliveryEvent['kind'], occurredAt: string, evidence: EmailFailureEvidence | null = null): EmailDeliveryEvent {
  return {
    provider: 'mailgun', providerEventId: `evt-${kind}-${occurredAt}`, occurredAt, recipient: EMAIL, kind, evidence,
    providerReason: null, smtpCode: null, enhancedCode: null, providerMessageId: null, purpose: null, ref: null,
  };
}

const fold = (events: readonly EmailDeliveryEvent[]) => events.reduce(foldStanding, emptyStanding(EMAIL));

describe('recipient-standing', () => {
  it('Σ1 — μόνιμη αποτυχία με απόδειξη ⇒ νεκρό από εκείνη τη στιγμή', () => {
    const standing = fold([event('delivered', '2026-09-01T00:00:00.000Z'), event('failed', '2026-09-10T00:00:00.000Z', 'mailbox-absent')]);
    expect(mailboxAbsentSince(standing)).toBe('2026-09-10T00:00:00.000Z');
    expect(standing.evidenceEventId).toBe('evt-failed-2026-09-10T00:00:00.000Z');
  });

  it('🔴 Σ2 — 605 / old / policy / deferred ⇒ ΚΑΜΙΑ απόδειξη', () => {
    const standing = fold([
      event('failed', '2026-09-10T00:00:00.000Z', 'suppressed-send'),
      event('failed', '2026-09-11T00:00:00.000Z', 'exhausted-retries'),
      event('failed', '2026-09-12T00:00:00.000Z', 'policy'),
      event('deferred', '2026-09-13T00:00:00.000Z', 'mailbox-absent'),
    ]);
    expect(mailboxAbsentSince(standing)).toBeNull();
    expect(standing.lastEventAt).toBe('2026-09-13T00:00:00.000Z');
  });

  it('Σ3 — παλιό delivered που φτάνει ΜΕΤΑ το νεότερο bounce ⇒ μένει νεκρό', () => {
    const standing = fold([event('failed', '2026-09-10T00:00:00.000Z', 'mailbox-absent'), event('delivered', '2026-09-05T00:00:00.000Z')]);
    expect(mailboxAbsentSince(standing)).toBe('2026-09-10T00:00:00.000Z');
    expect(standing.lastEventAt).toBe('2026-09-10T00:00:00.000Z');
  });

  it('🏆 Σ4 — νεότερη παράδοση ⇒ ξαναζεί χωρίς χειροκίνητο καθάρισμα', () => {
    const standing = fold([event('failed', '2026-09-10T00:00:00.000Z', 'mailbox-absent'), event('delivered', '2026-09-12T00:00:00.000Z')]);
    expect(mailboxAbsentSince(standing)).toBeNull();
  });

  it('Σ5 — το ίδιο συμβάν δύο φορές ⇒ ίδια κατάσταση · `becameAbsent` μόνο την πρώτη', () => {
    const bounce = event('failed', '2026-09-10T00:00:00.000Z', 'mailbox-absent');
    const once = foldStanding(emptyStanding(EMAIL), bounce);
    const twice = foldStanding(once, bounce);
    expect(twice).toEqual(once);
    expect(becameAbsent(emptyStanding(EMAIL), once)).toBe(true);
    expect(becameAbsent(once, twice)).toBe(false);
  });

  it('Σ6 — complaint καταγράφεται και ΔΕΝ σκοτώνει (αποδεικνύει παραλαβή)', () => {
    const standing = fold([event('complained', '2026-09-10T00:00:00.000Z')]);
    expect(standing.lastComplainedAt).toBe('2026-09-10T00:00:00.000Z');
    expect(mailboxAbsentSince(standing)).toBeNull();
  });
});
