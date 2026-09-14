/**
 * @jest-environment node
 *
 * @fileoverview Ο προσαρμογέας Mailgun — **ποιο «failed» αποδεικνύει νεκρό γραμματοκιβώτιο** (ADR-841 §7 Α21.20).
 *   • Π1-Π7 — ο πίνακας απόδειξης (🔴 605 · `old` · 5.7.1 · 5.2.2 ΔΕΝ είναι απόδειξη)
 *   • Α1-Α4 — ανάγνωση: κανονικοποίηση · συσχέτιση · άγνωστα συμβάντα · υπογραφή
 */

import { classifyMailgunFailure, readMailgunEvent, readMailgunSignatureFields } from '../mailgun-event-read';

interface Shape {
  readonly event?: string;
  readonly severity?: string;
  readonly reason?: string;
  readonly code?: number;
  readonly enhanced?: string;
  readonly variables?: Record<string, string>;
}

function payload(shape: Shape): unknown {
  return {
    signature: { timestamp: '1770000000', token: 'tok', signature: 'sig' },
    'event-data': {
      id: 'evt-0001',
      event: shape.event ?? 'failed',
      severity: shape.severity ?? 'permanent',
      reason: shape.reason,
      timestamp: 1_770_000_000.5,
      recipient: ' Office@Vafes.GR ',
      'delivery-status': { code: shape.code, 'enhanced-code': shape.enhanced },
      'user-variables': shape.variables ?? {},
      message: { headers: { 'message-id': '20260914.abc@mg.nestorconstruct.gr' } },
    },
  };
}

describe('classifyMailgunFailure — ο πίνακας απόδειξης', () => {
  it('Π1 — bounce + 5.1.1 (άγνωστος παραλήπτης) ⇒ mailbox-absent', () => {
    expect(classifyMailgunFailure('bounce', 550, '5.1.1')).toBe('mailbox-absent');
    expect(classifyMailgunFailure('hardfail', 550, '5.1.10')).toBe('mailbox-absent');
    expect(classifyMailgunFailure('bounce', 550, '5.2.1')).toBe('mailbox-absent');
  });

  it('🔴 Π2 — 605 / suppress-bounce ⇒ ο Mailgun ΔΕΝ δοκίμασε, όχι νέα απόδειξη', () => {
    expect(classifyMailgunFailure('suppress-bounce', 605, null)).toBe('suppressed-send');
    expect(classifyMailgunFailure('bounce', 605, '5.1.1')).toBe('suppressed-send');
  });

  it('🔴 Π3 — `old` (εξάντληση 8ω) ⇒ ΟΧΙ νεκρό', () => {
    expect(classifyMailgunFailure('old', 421, null)).toBe('exhausted-retries');
  });

  it('Π4 — 5.7.x / espblock ⇒ πολιτική, όχι ανυπαρξία', () => {
    expect(classifyMailgunFailure('bounce', 550, '5.7.1')).toBe('policy');
    expect(classifyMailgunFailure('espblock', 554, null)).toBe('policy');
  });

  it('Π5 — 5.2.2 γεμάτο ⇒ ζει', () => {
    expect(classifyMailgunFailure('bounce', 552, '5.2.2')).toBe('mailbox-full');
  });

  it('Π6 — bounce χωρίς enhanced: 550 ⇒ απόδειξη · 554 ⇒ άγνωστο', () => {
    expect(classifyMailgunFailure('bounce', 550, null)).toBe('mailbox-absent');
    expect(classifyMailgunFailure('bounce', 554, null)).toBe('unknown');
  });

  it('Π7 — `generic` / άγνωστος λόγος ⇒ ποτέ μαντεψιά προς «νεκρό»', () => {
    expect(classifyMailgunFailure('generic', 550, '5.1.1')).toBe('unknown');
    expect(classifyMailgunFailure(null, 550, null)).toBe('unknown');
  });
});

describe('readMailgunEvent — ανάγνωση', () => {
  it('Α1 — μόνιμη αποτυχία: κανονικοποιημένος παραλήπτης · ISO χρόνος · απόδειξη · συσχέτιση', () => {
    const event = readMailgunEvent(payload({
      reason: 'bounce', code: 550, enhanced: '5.1.1',
      variables: { 'nestor-purpose': 'showcase-email-confirmation', 'nestor-ref': 'secf_0001' },
    }));
    expect(event).toEqual({
      provider: 'mailgun', providerEventId: 'evt-0001', occurredAt: '2026-02-02T02:40:00.500Z',
      recipient: 'office@vafes.gr', kind: 'failed', evidence: 'mailbox-absent',
      providerReason: 'bounce', smtpCode: 550, enhancedCode: '5.1.1',
      providerMessageId: '20260914.abc@mg.nestorconstruct.gr',
      purpose: 'showcase-email-confirmation', ref: 'secf_0001',
    });
  });

  it('Α2 — προσωρινή ⇒ deferred · delivered/complained ⇒ χωρίς απόδειξη · άγνωστος σκοπός ⇒ null', () => {
    expect(readMailgunEvent(payload({ severity: 'temporary', reason: 'generic', code: 451 }))?.kind).toBe('deferred');
    const delivered = readMailgunEvent(payload({ event: 'delivered', variables: { 'nestor-purpose': 'phishing' } }));
    expect(delivered).toMatchObject({ kind: 'delivered', evidence: null, purpose: null });
    expect(readMailgunEvent(payload({ event: 'complained' }))?.kind).toBe('complained');
  });

  it('Α3 — opened/clicked/σκουπίδια ⇒ null (ack χωρίς ημερολόγιο)', () => {
    expect(readMailgunEvent(payload({ event: 'opened' }))).toBeNull();
    expect(readMailgunEvent({ 'event-data': { event: 'failed', severity: 'permanent' } })).toBeNull();
    expect(readMailgunEvent('not json object')).toBeNull();
  });

  it('Α4 — τα πεδία υπογραφής από το σώμα JSON (αριθμητική χρονοσφραγίδα ⇒ κείμενο)', () => {
    expect(readMailgunSignatureFields({ signature: { timestamp: 1770000000, token: 't', signature: 's' } }))
      .toEqual({ timestamp: '1770000000', token: 't', signature: 's' });
    expect(readMailgunSignatureFields(null)).toEqual({ timestamp: undefined, token: undefined, signature: undefined });
  });
});
