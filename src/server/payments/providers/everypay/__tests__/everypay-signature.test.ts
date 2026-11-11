/**
 * @jest-environment node
 *
 * ADR-ACC-030 — υπογραφές Everypay: κεφαλίδα webhook + IRIS `hash`.
 */

import { createHmac } from 'crypto';

import { judgeEverypayBodySignature, judgeEverypayIrisHash } from '../everypay-signature';

const SECRET = 'sk_test_secret';

function bodySignature(body: string, secret = SECRET): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('base64');
}

function irisHash(json: string, encoding: 'hex' | 'base64', secret = SECRET): string {
  const signature = createHmac('sha256', secret).update(json, 'utf8').digest(encoding);
  return Buffer.from(`${signature}|${json}`, 'utf8').toString('base64');
}

describe('judgeEverypayBodySignature', () => {
  const body = JSON.stringify({ token: 'pnt_abc', status: 'Paid' });

  it('δέχεται σωστή υπογραφή και επιστρέφει το σώμα', () => {
    const verdict = judgeEverypayBodySignature(body, bodySignature(body), SECRET);
    expect(verdict).toEqual({ valid: true, payload: { token: 'pnt_abc', status: 'Paid' } });
  });

  it('απορρίπτει υπογραφή με άλλο κλειδί', () => {
    expect(judgeEverypayBodySignature(body, bodySignature(body, 'sk_other'), SECRET)).toEqual({ valid: false, reason: 'signature-invalid' });
  });

  it('απορρίπτει αλλοιωμένο σώμα (ένας χαρακτήρας)', () => {
    const tampered = body.replace('pnt_abc', 'pnt_abd');
    expect(judgeEverypayBodySignature(tampered, bodySignature(body), SECRET)).toEqual({ valid: false, reason: 'signature-invalid' });
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

  it.each(['hex', 'base64'] as const)('δέχεται υπογραφή %s του ΙΔΙΟΥ HMAC και δίνει το υπογεγραμμένο JSON', (encoding) => {
    const verdict = judgeEverypayIrisHash(irisHash(json, encoding), SECRET);
    expect(verdict).toEqual({ valid: true, payload: JSON.parse(json) });
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
