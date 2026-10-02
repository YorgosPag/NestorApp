/**
 * @jest-environment node
 *
 * ADR-900 §3.8 — άγκυρα του ελεγκτή σφραγίδας PDF (PAdES), πάνω σε **συνθετικό** σφραγισμένο PDF.
 *
 * Σ1 γνήσιο ⇒ valid · Σ2 αλλαγμένο byte ⇒ digest-mismatch · Σ3 προσθήκη μετά την υπογραφή ⇒ byte-range-incomplete ·
 * Σ4 χωρίς υπογραφή ⇒ no-signature · Σ5 πιστοποιητικό εκτός ισχύος τη στιγμή της υπογραφής ·
 * Σ6 αλυσίδα: κενό μητρώο ⇒ chainTrusted false (γνήσιο ≠ εμπιστευτό) · Σ7 σκουπίδια στο /Contents ⇒ malformed-cms.
 */
import { verifyPdfSeal } from '../verify-pdf-seal';
import { makeSealedPdf, makeSigner, type SyntheticSigner } from './synthetic-sealed-pdf';

jest.mock('server-only', () => ({}));

const DAY = 86_400_000;
const NOW = new Date('2026-10-02T12:00:00.000Z');
const ORG_ID = 'VATEL-000000000';

let signer: SyntheticSigner;
let sealed: Uint8Array;

beforeAll(async () => {
  signer = await makeSigner(ORG_ID, new Date(NOW.getTime() - 30 * DAY), new Date(NOW.getTime() + 365 * DAY));
  sealed = await makeSealedPdf(signer, NOW);
}, 30_000);

function latin1(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('latin1');
}

describe('Σ1 — γνήσιο', () => {
  it('valid, με τον υπογράφοντα και την ώρα υπογραφής', async () => {
    const verdict = await verifyPdfSeal(sealed);
    expect(verdict).toMatchObject({
      kind: 'valid',
      signer: { organizationIdentifier: ORG_ID, commonName: 'SYNTHETIC SEAL', organization: 'SYNTHETIC ORG' },
      signedAt: NOW.toISOString(),
      timestamped: false,
    });
  });
});

describe('Σ2 — αλλοίωση', () => {
  it('🔴 ένα byte αλλαγμένο στο υπογεγραμμένο κείμενο ⇒ digest-mismatch', async () => {
    const tampered = sealed.slice();
    const at = latin1(tampered).indexOf('050681726003');
    tampered[at] = '9'.charCodeAt(0);
    expect(await verifyPdfSeal(tampered)).toEqual({ kind: 'invalid', reason: 'digest-mismatch' });
  });
});

describe('Σ3 — προσθήκη μετά την υπογραφή (incremental update)', () => {
  it('🔴 bytes μετά το τέλος της υπογεγραμμένης περιοχής ⇒ byte-range-incomplete', async () => {
    const appended = new Uint8Array([...sealed, ...Buffer.from('\n% shadow content\n', 'latin1')]);
    expect(await verifyPdfSeal(appended)).toEqual({ kind: 'invalid', reason: 'byte-range-incomplete' });
  });
});

describe('Σ4 — χωρίς υπογραφή', () => {
  it('απλό PDF ⇒ no-signature', async () => {
    expect(await verifyPdfSeal(new Uint8Array(Buffer.from('%PDF-1.7\n%%EOF\n', 'latin1')))).toEqual({
      kind: 'invalid',
      reason: 'no-signature',
    });
  });
});

describe('Σ5 — ισχύς πιστοποιητικού', () => {
  it('υπογραφή ΜΕΤΑ τη λήξη του πιστοποιητικού ⇒ certificate-not-valid-at-signing', async () => {
    const expired = await makeSigner(ORG_ID, new Date(NOW.getTime() - 400 * DAY), new Date(NOW.getTime() - 35 * DAY));
    const pdf = await makeSealedPdf(expired, NOW);
    expect(await verifyPdfSeal(pdf)).toEqual({ kind: 'invalid', reason: 'certificate-not-valid-at-signing' });
  }, 30_000);
});

describe('Σ6 — γνήσιο ≠ εμπιστευτό', () => {
  it('🔑 κενό μητρώο εμπιστοσύνης ⇒ chainTrusted: false (ΟΧΙ invalid)', async () => {
    const verdict = await verifyPdfSeal(sealed);
    expect(verdict.kind === 'valid' && verdict.chainTrusted).toBe(false);
  });
});

describe('Σ7 — χαλασμένο CMS', () => {
  it('σκουπίδια στη θέση του /Contents ⇒ malformed-cms', async () => {
    const broken = sealed.slice();
    const start = latin1(broken).indexOf('/Contents <') + '/Contents <'.length;
    broken.set(Buffer.from('ffffffff', 'latin1'), start);
    expect(await verifyPdfSeal(broken)).toEqual({ kind: 'invalid', reason: 'malformed-cms' });
  });
});
