/**
 * @jest-environment node
 *
 * ADR-905 §6 — η υπογραφή του εσωτερικού webhook: ο ΙΔΙΟΣ πυρήνας υπογράφει (Functions) και κρίνει (app).
 */

import {
  INTERNAL_WEBHOOK_TOLERANCE_SECONDS,
  judgeInternalWebhook,
  signInternalWebhook,
} from '../internal-webhook-signature';

const SECRET = 'a'.repeat(64);
const OTHER = 'b'.repeat(64);
const NOW = 1_800_000_000;
const BODY = '{"eventId":"e1","source":"file"}';

const judge = (header: string | null, body = BODY, secrets: readonly string[] = [SECRET], now = NOW) =>
  judgeInternalWebhook(header, body, { secrets, nowSeconds: now });

describe('internal webhook signature', () => {
  it('δέχεται την υπογραφή του ίδιου πυρήνα', () => {
    expect(judge(signInternalWebhook([SECRET], BODY, NOW))).toEqual({ valid: true });
  });

  it('απορρίπτει πειραγμένο σώμα (ένας χαρακτήρας)', () => {
    expect(judge(signInternalWebhook([SECRET], BODY, NOW), BODY.replace('e1', 'e2'))).toEqual({ valid: false, reason: 'signature_invalid' });
  });

  it('απορρίπτει άλλο κλειδί', () => {
    expect(judge(signInternalWebhook([OTHER], BODY, NOW))).toEqual({ valid: false, reason: 'signature_invalid' });
  });

  it('απορρίπτει χρονοσφραγίδα έξω από το παράθυρο — και προς τα πίσω και προς τα μπρος', () => {
    const late = NOW + INTERNAL_WEBHOOK_TOLERANCE_SECONDS + 1;
    expect(judge(signInternalWebhook([SECRET], BODY, NOW), BODY, [SECRET], late)).toEqual({ valid: false, reason: 'timestamp_expired' });
    expect(judge(signInternalWebhook([SECRET], BODY, late))).toEqual({ valid: false, reason: 'timestamp_expired' });
  });

  it('δέχεται στο όριο του παραθύρου', () => {
    expect(judge(signInternalWebhook([SECRET], BODY, NOW - INTERNAL_WEBHOOK_TOLERANCE_SECONDS))).toEqual({ valid: true });
  });

  it('η χρονοσφραγίδα είναι υπογεγραμμένη: αλλαγή της χωρίς κλειδί ⇒ άκυρη', () => {
    const header = signInternalWebhook([SECRET], BODY, NOW).replace(`t=${NOW}`, `t=${NOW + 1}`);
    expect(judge(header)).toEqual({ valid: false, reason: 'signature_invalid' });
  });

  it('περιστροφή: ο υπογραφέας με δύο κλειδιά περνά από κριτή με οποιοδήποτε από τα δύο', () => {
    const header = signInternalWebhook([OTHER, SECRET], BODY, NOW);
    expect(judge(header, BODY, [SECRET])).toEqual({ valid: true });
    expect(judge(header, BODY, [OTHER])).toEqual({ valid: true });
    expect(judge(signInternalWebhook([SECRET], BODY, NOW), BODY, ['', OTHER, SECRET])).toEqual({ valid: true });
  });

  it('χωρίς κλειδί ο κριτής ΑΡΝΕΙΤΑΙ (καμία ανοχή σε κανένα περιβάλλον)', () => {
    expect(judge(signInternalWebhook([SECRET], BODY, NOW), BODY, [])).toEqual({ valid: false, reason: 'secret_missing' });
    expect(judge(signInternalWebhook([SECRET], BODY, NOW), BODY, ['  '])).toEqual({ valid: false, reason: 'secret_missing' });
  });

  it.each([
    [null, 'signature_missing'],
    ['', 'signature_missing'],
    ['garbage', 'signature_malformed'],
    [`t=${NOW}`, 'signature_malformed'],
    [`v1=${'0'.repeat(64)}`, 'signature_malformed'],
    [`t=abc,v1=${'0'.repeat(64)}`, 'signature_malformed'],
    [`t=${NOW},v1=short`, 'signature_malformed'],
  ])('κεφαλίδα %p ⇒ %s', (header, reason) => {
    expect(judge(header)).toEqual({ valid: false, reason });
  });

  it('ο υπογραφέας αρνείται να υπογράψει χωρίς κλειδί', () => {
    expect(() => signInternalWebhook([''], BODY, NOW)).toThrow('no signing secret');
  });
});
