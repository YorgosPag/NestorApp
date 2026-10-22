/**
 * @jest-environment node
 *
 * ADR-918 — άγκυρες της **μηχανής σφράγισης PAdES B-T**, από άκρη σε άκρη: `openSealSession` → πελάτης CSC v2 →
 * πελάτης TSA RFC 3161 → CMS → `/Contents` → υποχρεωτικός αυτοέλεγχος ADR-902. Ο πάροχος είναι συνθετικός σε επίπεδο
 * HTTP, άρα **κανένας** πραγματικός πελάτης δεν παρακάμπτεται.
 *
 * Α1 σφράγιση ⇒ valid + timestamped + ίδιος υπογράφων · Α2 1 byte ⇒ digest-mismatch · Α3 TSA που λέει ψέματα ⇒ άρνηση ·
 * Α4 υπηρεσία με λάθος υπογραφή ⇒ καμία έξοδος · Α5 χωρίς ρύθμιση ⇒ ένα σήμα, κανένα PDF, καμία κλήση ·
 * Α6 ήδη υπογεγραμμένο / υπερχείλιση ⇒ ονομασμένη άρνηση · Α7 μόνο το `sealPdf` καλεί τη σύνθεση ·
 * Α8 ιδιότητες B-B (signingCertificateV2, ΟΧΙ signingTime, DER ταξινόμηση) · Α9 ECDSA r‖s → DER · Α10 ρύθμιση.
 */
import * as fs from 'fs';
import * as path from 'path';
import { createSign, generateKeyPairSync, createVerify } from 'crypto';
import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';

import { cmsSignatureValue } from '../cades-signed-data';
import { attributeValue, certificateDer, OID, parseSignedData, sha256, sha256Hex } from '../cms-primitives';
import { signedRangesOf } from '../pdf-byte-range';
import { cscSealSigner } from '../csc-seal-signer.server';
import type { PdfSealVerifier } from '../pdf-seal.types';
import { rfc3161TimestampAuthority } from '../rfc3161-timestamp.server';
import { sealConfigurationOf } from '../seal-config.server';
import { openSealSession, sealPdf } from '../seal-pdf.server';
import type { SealOutcome } from '../seal-signer.types';
import { verifyPdfSeal } from '../verify-pdf-seal';
import { CONFIGURED_ENV, makeSigner, syntheticProvider, type ProviderBehaviour, type SyntheticSigner } from './synthetic-seal-provider';
import { unsignedSyntheticPdf } from './synthetic-sealed-pdf';

const warn = jest.fn();
jest.mock('@/lib/telemetry', () => ({ createModuleLogger: () => ({ info: jest.fn(), warn: (...args: unknown[]) => warn(...args), error: jest.fn() }) }));

const DAY = 86_400_000;
const NOW = new Date('2026-10-21T10:00:00.000Z');
const ORG_ID = 'VATEL-999999999';
const PRESENTATION = { reason: 'synthetic reason', location: 'synthetic location' };

let seal: SyntheticSigner;
let tsa: SyntheticSigner;
let unsigned: Uint8Array;

beforeAll(async () => {
  seal = await makeSigner(ORG_ID, new Date(NOW.getTime() - 30 * DAY), new Date(NOW.getTime() + 365 * DAY));
  tsa = await makeSigner('SYNTHETIC-TSA', new Date(NOW.getTime() - 30 * DAY), new Date(NOW.getTime() + 365 * DAY), 'SYNTHETIC TSA');
  unsigned = await unsignedSyntheticPdf();
}, 30_000);

beforeEach(() => warn.mockClear());

async function sealWith(behaviour: Partial<ProviderBehaviour> & { tsa?: ProviderBehaviour['tsa'] } = {}, pdf?: Uint8Array) {
  const provider = syntheticProvider(seal, tsa, { tsa: { genTime: NOW }, ...behaviour });
  const session = openSealSession(provider.env, provider.transport);
  const outcome = await session.seal(pdf ?? unsigned, PRESENTATION);
  return { outcome, provider, session };
}

function sealedPdfOf(outcome: SealOutcome): Uint8Array {
  if (outcome.kind !== 'sealed') throw new Error(`αναμενόταν σφράγιση: ${JSON.stringify(outcome)}`);
  return outcome.pdf;
}

describe('Α1 — σφράγιση PAdES B-T', () => {
  it('valid + timestamped, υπογράφων = το φύλλο του παρόχου, ώρα = TSA', async () => {
    const { outcome } = await sealWith();
    const verdict = await verifyPdfSeal(sealedPdfOf(outcome));
    expect(verdict).toMatchObject({
      kind: 'valid',
      timestamped: true,
      signedAt: NOW.toISOString(),
      signer: { organizationIdentifier: ORG_ID, certificateSha256: sha256Hex(certificateDer(seal.certificate)) },
    });
  });

  it('λεξικό υπογραφής PAdES: /SubFilter /ETSI.CAdES.detached, /M, ένα /ByteRange ως το τέλος', async () => {
    const pdf = sealedPdfOf((await sealWith()).outcome);
    const text = Buffer.from(pdf).toString('latin1');
    expect(text).toContain('/SubFilter /ETSI.CAdES.detached');
    expect(text).toMatch(/\/M \(D:20261021100000Z/);
    expect(text.match(/\/ByteRange/g)).toHaveLength(1);
    expect(signedRangesOf(pdf).kind).toBe('found');
  });

  it('μία συνεδρία = ένα token OAuth2 για πολλές σφραγίσεις· SAD ανά σύνοψη', async () => {
    const provider = syntheticProvider(seal, tsa, { tsa: { genTime: NOW } });
    const session = openSealSession(provider.env, provider.transport);
    await session.seal(unsigned, PRESENTATION);
    await session.seal(unsigned, PRESENTATION);
    expect(provider.calls.filter((call) => call === 'oauth2/token')).toHaveLength(1);
    expect(provider.calls.filter((call) => call === 'credentials/authorize')).toHaveLength(2);
    expect(provider.calls.filter((call) => call === 'tsr')).toHaveLength(2);
  });
});

describe('Α2 — αλλοίωση μετά τη σφράγιση', () => {
  it('🔴 ένα byte ⇒ digest-mismatch', async () => {
    const tampered = sealedPdfOf((await sealWith()).outcome).slice();
    tampered[7] = '6'.charCodeAt(0);
    expect(await verifyPdfSeal(tampered)).toEqual({ kind: 'invalid', reason: 'digest-mismatch' });
  });
});

describe('Α3 — TSA που λέει ψέματα ⇒ κανένα PDF', () => {
  it.each([
    ['λάθος imprint', { genTime: NOW, wrongImprint: true }, 'timestamp-mismatch'],
    ['λάθος nonce', { genTime: NOW, wrongNonce: true }, 'timestamp-mismatch'],
    ['χωρίς nonce', { genTime: NOW, omitNonce: true }, 'timestamp-mismatch'],
    ['ρολόι εκτός ±5′', { genTime: new Date(NOW.getTime() - 10 * 60_000) }, 'timestamp-mismatch'],
    ['PKIStatus rejection', { genTime: NOW, status: 2 }, 'timestamp-rejected'],
  ] as const)('🔴 %s ⇒ %s', async (_label, tsaBehaviour, reason) => {
    const provider = syntheticProvider(seal, tsa, { tsa: tsaBehaviour });
    const outcome = await openSealSession(provider.env, { ...provider.transport, now: () => NOW }).seal(unsigned, PRESENTATION);
    expect(outcome).toMatchObject({ kind: 'failed', reason });
    expect('pdf' in outcome).toBe(false);
  });
});

describe('Α3β — ο ΔΙΚΟΣ μας έλεγχος imprint απαντά πρώτος (το pkijs είναι η δεύτερη ζώνη)', () => {
  it('🔴 λάθος imprint ⇒ η λεπτομέρεια ονομάζει το messageImprint, όχι γενική «αποτυχία υπογραφής TSA»', async () => {
    const provider = syntheticProvider(seal, tsa, { tsa: { genTime: NOW, wrongImprint: true } });
    const outcome = await openSealSession(provider.env, provider.transport).seal(unsigned, PRESENTATION);
    expect(outcome).toMatchObject({ kind: 'failed', reason: 'timestamp-mismatch', detail: expect.stringContaining('messageImprint') });
  });
});

describe('Α4β — ο αυτοέλεγχος κρίνει ΚΑΙ ταυτότητα ΚΑΙ χρονοσήμανση, όχι μόνο «valid»', () => {
  const depsWith = (verify: PdfSealVerifier) => {
    const provider = syntheticProvider(seal, tsa, { tsa: { genTime: NOW } });
    const configuration = sealConfigurationOf(provider.env);
    if (configuration.kind !== 'configured') throw new Error('ρύθμιση');
    return {
      signer: cscSealSigner(configuration.csc, provider.transport),
      timestampAuthority: rfc3161TimestampAuthority(configuration.tsa, provider.transport),
      now: () => NOW,
      verify,
    };
  };

  it('🔴 «valid» αλλά από ΑΛΛΟ πιστοποιητικό ⇒ self-check-failed', async () => {
    const outcome = await sealPdf(unsigned, PRESENTATION, depsWith(async (pdf) => {
      const verdict = await verifyPdfSeal(pdf);
      return verdict.kind === 'valid' ? { ...verdict, signer: { ...verdict.signer, certificateSha256: '00'.repeat(32) } } : verdict;
    }));
    expect(outcome).toMatchObject({ kind: 'failed', reason: 'self-check-failed', detail: expect.stringContaining('υπογράφων') });
  });

  it('🔴 «valid» αλλά χωρίς χρονοσήμανση (B-B αντί B-T) ⇒ self-check-failed', async () => {
    const outcome = await sealPdf(unsigned, PRESENTATION, depsWith(async (pdf) => {
      const verdict = await verifyPdfSeal(pdf);
      return verdict.kind === 'valid' ? { ...verdict, timestamped: false } : verdict;
    }));
    expect(outcome).toMatchObject({ kind: 'failed', reason: 'self-check-failed', detail: expect.stringContaining('B-T') });
  });
});

describe('Α4 — η θύρα επιστρέφει λάθος υπογραφή', () => {
  it('🔴 ο αυτοέλεγχος την πιάνει: self-check-failed / signature-invalid, κανένα PDF', async () => {
    const { outcome } = await sealWith({ wrongSignature: true });
    expect(outcome).toMatchObject({ kind: 'failed', reason: 'self-check-failed', verdictReason: 'signature-invalid' });
    expect('pdf' in outcome).toBe(false);
  });
});

describe('Α5 — χωρίς ρύθμιση', () => {
  it('🔴 κανένα PDF, καμία κλήση δικτύου, ΕΝΑ σήμα για όλη την εκτέλεση', async () => {
    const fetchImpl = jest.fn();
    const session = openSealSession({}, { fetchImpl, env: {}, now: () => NOW });
    const outcomes = [await session.seal(unsigned, PRESENTATION), await session.seal(unsigned, PRESENTATION), await session.seal(unsigned, PRESENTATION)];
    expect(session.configured).toBe(false);
    expect(outcomes.every((outcome) => outcome.kind === 'awaiting-seal-configuration')).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(session.finish()).toBe(3);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('καμία εκκρεμότητα ⇒ κανένα σήμα', () => {
    expect(openSealSession({}, { fetchImpl: jest.fn(), env: {}, now: () => NOW }).finish()).toBe(0);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('Α6 — ονομασμένες αρνήσεις εισόδου', () => {
  it('ήδη υπογεγραμμένο PDF ⇒ pdf-already-signed (σφραγίζουμε μόνο ό,τι εκδίδουμε)', async () => {
    const once = sealedPdfOf((await sealWith()).outcome);
    expect((await sealWith({}, once)).outcome).toMatchObject({ kind: 'failed', reason: 'pdf-already-signed' });
  });

  it('αλυσίδα που δεν χωρά στο κενό ⇒ contents-overflow, ποτέ κομμένο CMS', async () => {
    const leaf = certificateDer(seal.certificate);
    const { outcome } = await sealWith({ chain: Array.from({ length: 60 }, () => leaf) });
    expect(outcome).toMatchObject({ kind: 'failed', reason: 'contents-overflow' });
  });

  it('σκουπίδια αντί για PDF ⇒ pdf-unreadable', async () => {
    expect((await sealWith({}, new Uint8Array([1, 2, 3]))).outcome).toMatchObject({ kind: 'failed', reason: 'pdf-unreadable' });
  });
});

describe('Α7 — ο αυτοέλεγχος δεν παρακάμπτεται', () => {
  it('🔴 το `assemblePadesSeal` το καλεί ΜΟΝΟ το `sealPdf` (και το fixture του ελεγκτή)', () => {
    const root = path.join(__dirname, '..', '..', '..');
    const allowed = new Set(['server/pdf-seal/seal-pdf.server.ts', 'server/pdf-seal/__tests__/synthetic-sealed-pdf.ts']);
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { if (entry.name !== 'node_modules') walk(full); continue; }
        if (!/\.tsx?$/.test(entry.name) || full === __filename) continue;
        const relative = path.relative(root, full).split(path.sep).join('/');
        if (fs.readFileSync(full, 'utf8').includes('assemblePadesSeal') && !allowed.has(relative)) offenders.push(relative);
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});

describe('Α8 — υπογεγραμμένες ιδιότητες PAdES B-B', () => {
  it('signingCertificateV2 = SHA-256 του φύλλου · ΚΑΜΙΑ signingTime · SET OF ταξινομημένο (DER)', async () => {
    const ranges = signedRangesOf(sealedPdfOf((await sealWith()).outcome));
    if (ranges.kind !== 'found') throw new Error('χωρίς υπογραφή');
    const signerInfo = parseSignedData(ranges.cms)?.signerInfos[0];
    expect(attributeValue(signerInfo?.signedAttrs, OID.signingTime)).toBeNull();
    const ess = attributeValue(signerInfo?.signedAttrs, OID.signingCertificateV2) as asn1js.Sequence;
    const certHash = ((ess.valueBlock.value[0] as asn1js.Sequence).valueBlock.value[0] as asn1js.Sequence).valueBlock.value[0] as asn1js.OctetString;
    expect(Buffer.from(certHash.valueBlock.valueHexView).equals(Buffer.from(sha256(certificateDer(seal.certificate))))).toBe(true);
    const encoded = (signerInfo?.signedAttrs?.attributes ?? []).map((a: pkijs.Attribute) => Buffer.from(a.toSchema().toBER(false)));
    expect(encoded.map((b) => b.toString('hex'))).toEqual([...encoded].sort(Buffer.compare).map((b) => b.toString('hex')));
    expect(attributeValue(signerInfo?.unsignedAttrs, OID.timeStampToken)).not.toBeNull();
  });
});

describe('Α9 — ECDSA: ωμό r‖s του CSC → DER Ecdsa-Sig-Value', () => {
  it('η μετατροπή επαληθεύεται από τον Node ως DER', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const data = Buffer.from('nestor seal');
    const raw = createSign('SHA256').update(data).sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });
    const spki = publicKey.export({ format: 'der', type: 'spki' });
    const leaf = new pkijs.Certificate();
    leaf.subjectPublicKeyInfo = new pkijs.PublicKeyInfo({ schema: asn1js.fromBER(new Uint8Array(spki).buffer).result });
    const der = cmsSignatureValue(new Uint8Array(raw), 'ecdsa-sha256', leaf);
    expect(der).not.toBeNull();
    expect(createVerify('SHA256').update(data).verify({ key: publicKey, dsaEncoding: 'der' }, Buffer.from(der as Uint8Array))).toBe(true);
    expect(cmsSignatureValue(new Uint8Array(raw.subarray(1)), 'ecdsa-sha256', leaf)).toBeNull();
  });
});

describe('Α10 — ρύθμιση', () => {
  it('όλα παρόντα ⇒ configured', () => {
    expect(sealConfigurationOf(CONFIGURED_ENV).kind).toBe('configured');
  });

  it('κενό / μόνο κενά / http: ⇒ μετρούν ως απούσα, με το ΟΝΟΜΑ', () => {
    const env = { ...CONFIGURED_ENV, NESTOR_SEAL_CSC_CLIENT_SECRET: '   ', NESTOR_SEAL_TSA_URL: 'http://tsa.example/tsr' };
    expect(sealConfigurationOf(env)).toEqual({
      kind: 'awaiting-seal-configuration',
      missing: ['NESTOR_SEAL_CSC_CLIENT_SECRET', 'NESTOR_SEAL_TSA_URL'],
    });
  });
});
