/**
 * @jest-environment node
 *
 * @fileoverview Υπογραφή webhook Mailgun — η κρίση (ADR-841 §7 Α21.20).
 *   • Υ1 έγκυρη · Υ2 αλλοιωμένη · Υ3 μπαγιάτικη · Υ4 λείπουν πεδία · Υ5 χωρίς κλειδί ανά πολιτική · Υ6 μη αριθμητική χρονοσφραγίδα
 */

import { createHmac } from 'crypto';

import { judgeMailgunSignature, MAILGUN_WEBHOOK_MAX_AGE_SECONDS } from '../mailgun-signature';

const KEY = 'key-fixture-signing';
const NOW = 1_770_000_000;

function signed(timestamp: number, token = 'tok-0001'): { timestamp: string; token: string; signature: string } {
  const stamp = String(timestamp);
  return { timestamp: stamp, token, signature: createHmac('sha256', KEY).update(stamp + token).digest('hex') };
}

const context = { signingKey: KEY, requireSecret: true, nowSeconds: NOW };

describe('judgeMailgunSignature', () => {
  it('Υ1 — έγκυρη υπογραφή ⇒ επιβεβαιωμένη', () => {
    expect(judgeMailgunSignature(signed(NOW), context)).toEqual({ valid: true, verified: true });
  });

  it('Υ2 — αλλοιωμένο token ⇒ άκυρη (η υπογραφή καλύπτει timestamp ΚΑΙ token)', () => {
    const fields = { ...signed(NOW), token: 'tok-0002' };
    expect(judgeMailgunSignature(fields, context)).toEqual({ valid: false, reason: 'signature_invalid' });
  });

  it('Υ3 — έξω από το παράθυρο ⇒ μπαγιάτικη, και στις δύο κατευθύνσεις', () => {
    const past = signed(NOW - MAILGUN_WEBHOOK_MAX_AGE_SECONDS - 1);
    const future = signed(NOW + MAILGUN_WEBHOOK_MAX_AGE_SECONDS + 1);
    expect(judgeMailgunSignature(past, context)).toEqual({ valid: false, reason: 'timestamp_expired' });
    expect(judgeMailgunSignature(future, context)).toEqual({ valid: false, reason: 'timestamp_expired' });
    expect(judgeMailgunSignature(signed(NOW - MAILGUN_WEBHOOK_MAX_AGE_SECONDS), context).valid).toBe(true);
  });

  it('Υ4 — λείπει πεδίο ⇒ άρνηση πριν από κάθε υπολογισμό', () => {
    const { signature: _dropped, ...partial } = signed(NOW);
    expect(judgeMailgunSignature(partial, context)).toEqual({ valid: false, reason: 'signature_fields_missing' });
  });

  it('🔴 Υ5 — χωρίς κλειδί: production αρνείται · development περνά ΑΝΕΠΙΒΕΒΑΙΩΤΟ (ποτέ σιωπηλό «έγκυρο»)', () => {
    expect(judgeMailgunSignature(signed(NOW), { ...context, signingKey: '  ' }))
      .toEqual({ valid: false, reason: 'webhook_secret_missing' });
    expect(judgeMailgunSignature({}, { ...context, signingKey: undefined, requireSecret: false }))
      .toEqual({ valid: true, verified: false });
  });

  it('Υ6 — μη αριθμητική χρονοσφραγίδα ⇒ άρνηση (όχι `NaN` που περνά τη σύγκριση)', () => {
    expect(judgeMailgunSignature({ ...signed(NOW), timestamp: 'abc' }, context))
      .toEqual({ valid: false, reason: 'timestamp_expired' });
  });
});
