/**
 * ADR-918 — **Συνθετικός πάροχος σφραγίδας** για τις άγκυρες: κλειδί, υπηρεσία CSC v2 και TSA RFC 3161,
 * **σε επίπεδο HTTP** (`fetchImpl`). Έτσι οι άγκυρες τρέχουν τον **πραγματικό** πελάτη CSC και τον
 * **πραγματικό** πελάτη TSA από άκρη σε άκρη — καμία θύρα δεν παρακάμπτεται.
 *
 * Όλα παράγονται μέσα στο test: κανένα πραγματικό κλειδί, κανένα δυαδικό fixture, κανένα δίκτυο.
 * Οι «χαλασμένες» συμπεριφορές (λάθος υπογραφή, λάθος imprint/nonce, άρνηση) είναι ρητές επιλογές,
 * ώστε κάθε άγκυρα άρνησης να ονομάζει **ποιο** ψέμα ειπώθηκε.
 */
import { constants, createPrivateKey, privateEncrypt, randomBytes, webcrypto } from 'crypto';
import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';

import type { EnvironmentSource } from '@/lib/environment/environment-audit';

import { CMS_ENGINE, derOf, OID, sha256 } from '../cms-primitives';
import type { SealSigner } from '../seal-signer.types';
import type { SealTransport } from '../seal-transport.server';

export interface SyntheticSigner {
  readonly certificate: pkijs.Certificate;
  readonly privateKey: CryptoKey;
}

/** DigestInfo(SHA-256) — RFC 8017 §9.2: ό,τι κάνει ένα HSM όταν του δίνεις **σύνοψη** για PKCS#1 v1.5. */
const DIGEST_INFO_SHA256 = Buffer.from('3031300d060960864801650304020105000420', 'hex');

function attr(type: string, value: string): pkijs.AttributeTypeAndValue {
  return new pkijs.AttributeTypeAndValue({ type, value: new asn1js.Utf8String({ value }) });
}

/** Αυτο-υπογεγραμμένο πιστοποιητικό RSA-2048 με `organizationIdentifier` (eIDAS OID 2.5.4.97). */
export async function makeSigner(organizationIdentifier: string, validFrom: Date, validTo: Date, commonName = 'SYNTHETIC SEAL'): Promise<SyntheticSigner> {
  const keys = (await webcrypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const certificate = new pkijs.Certificate();
  certificate.version = 2;
  certificate.serialNumber = new asn1js.Integer({ valueHex: new Uint8Array([0x01, ...randomBytes(7)]).buffer });
  for (const name of [certificate.subject, certificate.issuer]) {
    name.typesAndValues.push(attr(OID.commonName, commonName), attr(OID.organization, 'SYNTHETIC ORG'), attr(OID.organizationIdentifier, organizationIdentifier));
  }
  certificate.notBefore.value = validFrom;
  certificate.notAfter.value = validTo;
  await certificate.subjectPublicKeyInfo.importKey(keys.publicKey, CMS_ENGINE);
  await certificate.sign(keys.privateKey, 'SHA-256', CMS_ENGINE);
  return { certificate, privateKey: keys.privateKey };
}

/** Υπογραφή PKCS#1 v1.5 πάνω σε **ήδη υπολογισμένη** σύνοψη — όπως το `signHash` ενός QTSP. */
export async function signPrehashed(signer: SyntheticSigner, digest: Uint8Array): Promise<Uint8Array> {
  const pkcs8 = new Uint8Array(await webcrypto.subtle.exportKey('pkcs8', signer.privateKey));
  const key = createPrivateKey({ key: Buffer.from(pkcs8), format: 'der', type: 'pkcs8' });
  return new Uint8Array(privateEncrypt({ key, padding: constants.RSA_PKCS1_PADDING }, Buffer.concat([DIGEST_INFO_SHA256, digest])));
}

/** Η θύρα `SealSigner` απευθείας (χωρίς HTTP) — για το fixture του ελεγκτή. */
export function directSealSigner(signer: SyntheticSigner): SealSigner {
  return {
    certificateChain: async () => ({ kind: 'ok', value: [derOf(signer.certificate.toSchema())] }),
    signDigest: async (digest) => ({ kind: 'ok', value: await signPrehashed(signer, digest) }),
  };
}

// ─── TSA ────────────────────────────────────────────────────────────────────

export interface TsaBehaviour {
  readonly genTime: Date;
  readonly wrongImprint?: boolean;
  readonly wrongNonce?: boolean;
  readonly omitNonce?: boolean;
  /** PKIStatus ≠ 0 (π.χ. 2 = rejection). */
  readonly status?: number;
}

async function tstToken(tsa: SyntheticSigner, request: pkijs.TimeStampReq, behaviour: TsaBehaviour): Promise<pkijs.ContentInfo> {
  const imprint = behaviour.wrongImprint
    ? new pkijs.MessageImprint({ hashAlgorithm: request.messageImprint.hashAlgorithm, hashedMessage: new asn1js.OctetString({ valueHex: sha256(new Uint8Array([1])) }) })
    : request.messageImprint;
  const nonce = behaviour.wrongNonce ? new asn1js.Integer({ value: 42 }) : request.nonce;
  const tstInfo = new pkijs.TSTInfo({
    version: 1,
    policy: '1.3.6.1.4.1.99999.1',
    messageImprint: imprint,
    serialNumber: new asn1js.Integer({ value: 7 }),
    genTime: behaviour.genTime,
    ...(behaviour.omitNonce || !nonce ? {} : { nonce }),
  });
  const tstDer = derOf(tstInfo.toSchema());
  const signedData = new pkijs.SignedData({
    version: 3,
    encapContentInfo: new pkijs.EncapsulatedContentInfo({ eContentType: OID.tstInfo, eContent: new asn1js.OctetString({ valueHex: tstDer.slice().buffer }) }),
    signerInfos: [
      new pkijs.SignerInfo({
        version: 1,
        sid: new pkijs.IssuerAndSerialNumber({ issuer: tsa.certificate.issuer, serialNumber: tsa.certificate.serialNumber }),
        signedAttrs: new pkijs.SignedAndUnsignedAttributes({
          type: 0,
          attributes: [
            new pkijs.Attribute({ type: OID.contentType, values: [new asn1js.ObjectIdentifier({ value: OID.tstInfo })] }),
            new pkijs.Attribute({ type: OID.messageDigest, values: [new asn1js.OctetString({ valueHex: sha256(tstDer) })] }),
          ],
        }),
      }),
    ],
    certificates: [tsa.certificate],
  });
  // Ο κατασκευαστής του pkijs κάνει το eContent «constructed» (BER)· μια πραγματική TSA στέλνει DER (primitive).
  signedData.encapContentInfo.eContent = new asn1js.OctetString({ valueHex: tstDer.slice().buffer });
  await signedData.sign(tsa.privateKey, 0, 'SHA-256', undefined, CMS_ENGINE);
  return new pkijs.ContentInfo({ contentType: pkijs.ContentInfo.SIGNED_DATA, content: signedData.toSchema(true) });
}

export async function tsaReply(tsa: SyntheticSigner, requestDer: Uint8Array, behaviour: TsaBehaviour): Promise<Uint8Array> {
  const request = new pkijs.TimeStampReq({ schema: asn1js.fromBER(requestDer.slice().buffer).result });
  const status = behaviour.status ?? 0;
  const response = new pkijs.TimeStampResp({
    status: new pkijs.PKIStatusInfo({ status }),
    ...(status === 0 ? { timeStampToken: await tstToken(tsa, request, behaviour) } : {}),
  });
  return derOf(response.toSchema());
}

// ─── CSC v2 ─────────────────────────────────────────────────────────────────

export const CSC_BASE = 'https://csc.synthetic.test/csc/v2';
export const TSA_URL = 'https://tsa.synthetic.test/tsr';

export interface ProviderBehaviour {
  readonly tsa: TsaBehaviour;
  /** Η «υπηρεσία» υπογράφει **άλλη** σύνοψη από αυτή που της δόθηκε. */
  readonly wrongSignature?: boolean;
  /** Αλυσίδα που επιστρέφει το `credentials/info` (προεπιλογή: το φύλλο). */
  readonly chain?: readonly Uint8Array[];
}

export interface SyntheticProvider {
  readonly transport: SealTransport;
  readonly env: EnvironmentSource;
  /** Κάθε κλήση: `μέθοδος` (π.χ. `oauth2/token`, `tsr`). */
  readonly calls: string[];
}

const ACCESS_TOKEN = 'synthetic-access-token';
const SAD = 'synthetic-sad';

export const CONFIGURED_ENV: EnvironmentSource = {
  NESTOR_SEAL_CSC_BASE_URL: CSC_BASE,
  NESTOR_SEAL_CSC_CLIENT_ID: 'client',
  NESTOR_SEAL_CSC_CLIENT_SECRET: 'secret',
  NESTOR_SEAL_CSC_CREDENTIAL_ID: 'cred-1',
  NESTOR_SEAL_TSA_URL: TSA_URL,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Η υπηρεσία CSC: απαιτεί Bearer, και **δένει το SAD με τη σύνοψη** — signHash με άλλη σύνοψη ⇒ 400. */
async function cscRoute(method: string, body: Record<string, unknown>, signer: SyntheticSigner, behaviour: ProviderBehaviour, bound: { hash: string | null }): Promise<Response> {
  if (method === 'credentials/info') {
    const chain = behaviour.chain ?? [derOf(signer.certificate.toSchema())];
    return json({ cert: { certificates: chain.map((der) => Buffer.from(der).toString('base64')) }, key: { algo: [OID.rsaEncryption] } });
  }
  const hashes = body.hashes as string[];
  if (method === 'credentials/authorize') {
    bound.hash = hashes[0];
    return json({ SAD });
  }
  if (body.SAD !== SAD || hashes[0] !== bound.hash || body.hashAlgorithmOID !== OID.sha256) return json({ error: 'invalid_request' }, 400);
  const digest = new Uint8Array(Buffer.from(hashes[0], 'base64'));
  const signed = behaviour.wrongSignature ? sha256(digest) : digest;
  return json({ signatures: [Buffer.from(await signPrehashed(signer, signed)).toString('base64')] });
}

export function syntheticProvider(signer: SyntheticSigner, tsa: SyntheticSigner, behaviour: ProviderBehaviour): SyntheticProvider {
  const calls: string[] = [];
  const bound = { hash: null as string | null };
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    if (url === TSA_URL) {
      calls.push('tsr');
      return new Response(await tsaReply(tsa, init?.body as Uint8Array, behaviour.tsa), { status: 200 });
    }
    const method = url.slice(CSC_BASE.length + 1);
    calls.push(method);
    if (method === 'info') return json({ oauth2: CSC_BASE });
    if (method === 'oauth2/token') return json({ access_token: ACCESS_TOKEN, expires_in: 3600 });
    if (headers.Authorization !== `Bearer ${ACCESS_TOKEN}`) return json({ error: 'unauthorized' }, 401);
    return cscRoute(method, JSON.parse(String(init?.body)) as Record<string, unknown>, signer, behaviour, bound);
  };
  return { transport: { fetchImpl, env: CONFIGURED_ENV, now: () => behaviour.tsa.genTime }, env: CONFIGURED_ENV, calls };
}
