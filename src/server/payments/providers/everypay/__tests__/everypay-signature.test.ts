/**
 * @jest-environment node
 *
 * ADR-ACC-030 — υπογραφές Everypay: κεφαλίδα webhook + IRIS `hash`.
 */

import { createHmac } from 'crypto';

import { judgeEverypayBodySignature, judgeEverypayIrisHash } from '../everypay-signature';

const SECRET = 'sk_test_secret';

/** Ο τύπος της τεκμηρίωσης: `base64_encode(hash_hmac('sha256', $payload, $secretKey))` — base64 του **hex**. */
function bodySignature(body: string, secret = SECRET): string {
  const hex = createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  return Buffer.from(hex, 'utf8').toString('base64');
}

function irisHash(json: string, encoding: 'hex' | 'base64', secret = SECRET): string {
  const signature = createHmac('sha256', secret).update(json, 'utf8').digest(encoding);
  return Buffer.from(`${signature}|${json}`, 'utf8').toString('base64');
}

describe('judgeEverypayBodySignature', () => {
  const body = JSON.stringify({ token: 'pnt_abc', status: 'Paid' });

  it('δέχεται σωστή υπογραφή και επιστρέφει το σώμα', () => {
    const verdict = judgeEverypayBodySignature(body, bodySignature(body), SECRET);
    expect(verdict).toEqual({ valid: true, payload: { token: 'pnt_abc', status: 'Paid' }, scheme: 'webhook-header' });
  });

  it('απορρίπτει υπογραφή με άλλο κλειδί', () => {
    expect(judgeEverypayBodySignature(body, bodySignature(body, 'sk_other'), SECRET)).toEqual({ valid: false, reason: 'signature-invalid' });
  });

  it('απορρίπτει αλλοιωμένο σώμα (ένας χαρακτήρας)', () => {
    const tampered = body.replace('pnt_abc', 'pnt_abd');
    expect(judgeEverypayBodySignature(tampered, bodySignature(body), SECRET)).toEqual({ valid: false, reason: 'signature-invalid' });
  });

  it('απορρίπτει base64 των 32 bytes του ΙΔΙΟΥ HMAC — η μορφή της Everypay είναι base64 του hex (§5.9 #3)', () => {
    const rawDigest = createHmac('sha256', SECRET).update(body, 'utf8').digest('base64');
    expect(judgeEverypayBodySignature(body, rawDigest, SECRET)).toEqual({ valid: false, reason: 'signature-invalid' });
  });

  it('απορρίπτει απούσα κεφαλίδα', () => {
    expect(judgeEverypayBodySignature(body, null, SECRET)).toEqual({ valid: false, reason: 'signature-missing' });
  });

  it('έγκυρη υπογραφή πάνω σε μη-JSON ⇒ payload-malformed, ποτέ σιωπηλό «έγκυρο»', () => {
    expect(judgeEverypayBodySignature('not json', bodySignature('not json'), SECRET)).toEqual({ valid: false, reason: 'payload-malformed' });
  });
});

describe('judgeEverypayIrisHash', () => {
  const json = JSON.stringify({ callback_url: 'https://x/cb', token: 'src_123', md: 'pchk_1', type: 'iris' });

  // ADR-ACC-030 §5.8 #1: η μορφή μετρήθηκε ζωντανά 2026-11-14 (`iris-hash-hex`) ⇒ μόνο hex.
  it('δέχεται υπογραφή hex, δίνει το υπογεγραμμένο JSON και τη μορφή iris-hash-hex', () => {
    const verdict = judgeEverypayIrisHash(irisHash(json, 'hex'), SECRET);
    expect(verdict).toEqual({ valid: true, payload: JSON.parse(json), scheme: 'iris-hash-hex' });
  });

  it('απορρίπτει base64 των 32 bytes του ΙΔΙΟΥ HMAC — η μορφή της Everypay είναι hex (§5.8 #1)', () => {
    expect(judgeEverypayIrisHash(irisHash(json, 'base64'), SECRET)).toEqual({ valid: false, reason: 'signature-invalid' });
  });

  it('απορρίπτει hash με άλλο κλειδί', () => {
    expect(judgeEverypayIrisHash(irisHash(json, 'hex', 'sk_other'), SECRET)).toEqual({ valid: false, reason: 'signature-invalid' });
  });

  it('απορρίπτει έγκυρη υπογραφή κολλημένη πάνω σε άλλο token', () => {
    const signature = createHmac('sha256', SECRET).update(json, 'utf8').digest('hex');
    const forged = Buffer.from(`${signature}|${json.replace('src_123', 'src_999')}`, 'utf8').toString('base64');
    expect(judgeEverypayIrisHash(forged, SECRET)).toEqual({ valid: false, reason: 'signature-invalid' });
  });

  it('απορρίπτει hash χωρίς διαχωριστικό και απόν hash', () => {
    expect(judgeEverypayIrisHash(Buffer.from('nopipe').toString('base64'), SECRET)).toEqual({ valid: false, reason: 'signature-invalid' });
    expect(judgeEverypayIrisHash(undefined, SECRET)).toEqual({ valid: false, reason: 'signature-missing' });
  });
});
