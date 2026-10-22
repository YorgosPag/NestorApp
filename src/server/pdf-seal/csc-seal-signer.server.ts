/**
 * @module server/pdf-seal/csc-seal-signer.server
 * @description **Ο προσαρμογέας παραγωγής της θύρας `SealSigner`**: Cloud Signature Consortium API **v2.0.0.2**
 * (ETSI TS 119 432) — ADR-918 §4. Ένας προσαρμογέας για **κάθε** QTSP που μιλά CSC (HARICA, SSL.com eSigner,
 * Ascertia, BankID…)· ο πάροχος αλλάζει **με ρύθμιση**, ο κώδικας όχι.
 *
 * ```
 * POST {base}/info                       → { oauth2 }            (ανακάλυψη εξυπηρετητή εξουσιοδότησης)
 * POST {oauth2}/oauth2/token             → { access_token }      grant_type=client_credentials (RFC 6749 §4.4)
 * POST {base}/credentials/info           → { cert.certificates[], key.algo[] }   certificates=chain
 * POST {base}/credentials/authorize      → { SAD }               hashes=[σύνοψη] · numSignatures=1
 * POST {base}/signatures/signHash        → { signatures[] }      credentialID · SAD · hashes · hashAlgorithmOID · signAlgo
 * ```
 *
 * 🔑 **Ονόματα πεδίων του v2, επαληθευμένα στο OpenAPI του v2.0.0.2** (21/10): `hashes` + `hashAlgorithmOID`.
 * ⚠️ Το v1 έλεγε `hash` + `hashAlgo`, και πάροχοι «v2» τα κρατούν (μετρημένο: Aloaha) — αν ο πραγματικός πάροχος
 * απαντήσει 400 εδώ, η διόρθωση είναι **εδώ** και μόνο εδώ, με απόδειξη από την τεκμηρίωσή του.
 * 🔑 Το SAD δένεται με **αυτή** τη σύνοψη (CSC §11.9): ζητείται ανά υπογραφή, ποτέ δεν επαναχρησιμοποιείται.
 * 🔑 Το `signAlgo` διαλέγεται από τα `key.algo` που **δηλώνει** το credential: προτιμάται το σύνθετο OID
 *    (sha256WithRSA / ecdsa-with-SHA256)· αλλιώς το OID του κλειδιού + `hashAlgorithmOID` (CSC §11.10).
 */

import 'server-only';

import { OID } from './cms-primitives';
import type { CscConfiguration } from './seal-config.server';
import type { SealSignatureAlgorithm, SealSigner, SealSignerResult } from './seal-signer.types';
import { jsonOf, postJson, postOnce, type SealCall, type SealTransport } from './seal-transport.server';

/** Περιθώριο πριν τη λήξη του token — ποτέ κλήση με token που λήγει «στη διαδρομή». */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;
const DEFAULT_TOKEN_LIFETIME_S = 300;

const COMBINED_OID: Readonly<Record<SealSignatureAlgorithm, string>> = {
  'rsa-pkcs1-sha256': OID.sha256WithRsa,
  'ecdsa-sha256': OID.ecdsaWithSha256,
};
const KEY_OID: Readonly<Record<SealSignatureAlgorithm, string>> = {
  'rsa-pkcs1-sha256': OID.rsaEncryption,
  'ecdsa-sha256': OID.ecPublicKey,
};

type Failed = Extract<SealSignerResult<never>, { kind: 'failed' }>;

function failedFrom(call: Exclude<SealCall, { kind: 'ok' }>, step: string): Failed {
  const reason = call.kind === 'unavailable' ? 'signer-unavailable' : 'signer-rejected';
  return { kind: 'failed', reason, detail: `${step}: ${call.detail}` };
}

const rejected = (detail: string): Failed => ({ kind: 'failed', reason: 'signer-rejected', detail });

function record(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function strings(value: unknown): readonly string[] | null {
  return Array.isArray(value) && value.every((item): item is string => typeof item === 'string') ? value : null;
}

/** Αυστηρό base64 (RFC 4648)· το `Buffer.from` αλλιώς σιωπηλά «διορθώνει» σκουπίδια. */
function base64Bytes(value: string): Uint8Array | null {
  const clean = value.replace(/\s+/g, '');
  if (clean.length === 0 || clean.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(clean)) return null;
  return new Uint8Array(Buffer.from(clean, 'base64'));
}

interface CredentialInfo {
  readonly chain: readonly Uint8Array[];
  readonly keyAlgorithms: readonly string[];
}

function parseCredentialInfo(json: unknown): CredentialInfo | null {
  const body = record(json);
  const certificates = strings(record(body?.cert)?.certificates);
  if (certificates === null || certificates.length === 0) return null;
  const chain = certificates.map(base64Bytes);
  if (chain.some((der) => der === null)) return null;
  return { chain: chain.filter((der): der is Uint8Array => der !== null), keyAlgorithms: strings(record(body?.key)?.algo) ?? [] };
}

/** `signAlgo`: σύνθετο OID αν το credential το δηλώνει (ή δεν δηλώνει τίποτα)· αλλιώς το OID του κλειδιού. */
export function cscSignAlgorithm(algorithm: SealSignatureAlgorithm, declared: readonly string[]): string {
  if (declared.length === 0 || declared.includes(COMBINED_OID[algorithm])) return COMBINED_OID[algorithm];
  return declared.includes(KEY_OID[algorithm]) ? KEY_OID[algorithm] : COMBINED_OID[algorithm];
}

class CscSession implements SealSigner {
  private token: { readonly value: string; readonly expiresAt: number } | null = null;
  private info: CredentialInfo | null = null;

  constructor(
    private readonly config: CscConfiguration,
    private readonly transport: SealTransport,
  ) {}

  private async authorizationServer(): Promise<string> {
    const call = await postJson(this.transport, `${this.config.baseUrl}/info`, {});
    const oauth2 = call.kind === 'ok' ? record(call.json)?.oauth2 : undefined;
    return typeof oauth2 === 'string' && oauth2.startsWith('https://') ? oauth2.replace(/\/+$/, '') : this.config.baseUrl;
  }

  private async accessToken(): Promise<SealSignerResult<string>> {
    if (this.token !== null && this.token.expiresAt > this.transport.now().getTime()) return { kind: 'ok', value: this.token.value };
    const form = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });
    const call = await postOnce(this.transport, `${await this.authorizationServer()}/oauth2/token`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: form.toString(),
    });
    if (call.kind !== 'ok') return failedFrom(call, 'oauth2/token');
    const body = record(jsonOf(call.body));
    const value = body?.access_token;
    if (typeof value !== 'string' || value.length === 0) return rejected('oauth2/token: χωρίς access_token');
    const lifetime = typeof body?.expires_in === 'number' ? body.expires_in : DEFAULT_TOKEN_LIFETIME_S;
    this.token = { value, expiresAt: this.transport.now().getTime() + lifetime * 1000 - TOKEN_EXPIRY_MARGIN_MS };
    return { kind: 'ok', value };
  }

  /** Κλήση CSC με Bearer — ένα σημείο για όλες τις μεθόδους του credential. */
  private async call(method: string, payload: Readonly<Record<string, unknown>>): Promise<SealSignerResult<unknown>> {
    const token = await this.accessToken();
    if (token.kind === 'failed') return token;
    const call = await postJson(this.transport, `${this.config.baseUrl}/${method}`, payload, { Authorization: `Bearer ${token.value}` });
    return call.kind === 'ok' ? { kind: 'ok', value: call.json } : failedFrom(call, method);
  }

  private async credentialInfo(): Promise<SealSignerResult<CredentialInfo>> {
    if (this.info !== null) return { kind: 'ok', value: this.info };
    const call = await this.call('credentials/info', { credentialID: this.config.credentialId, certificates: 'chain', certInfo: false });
    if (call.kind === 'failed') return call;
    const info = parseCredentialInfo(call.value);
    if (info === null) return rejected('credentials/info: χωρίς αναγνώσιμη αλυσίδα');
    this.info = info;
    return { kind: 'ok', value: info };
  }

  async certificateChain(): Promise<SealSignerResult<readonly Uint8Array[]>> {
    const info = await this.credentialInfo();
    return info.kind === 'ok' ? { kind: 'ok', value: info.value.chain } : info;
  }

  async signDigest(digest: Uint8Array, algorithm: SealSignatureAlgorithm): Promise<SealSignerResult<Uint8Array>> {
    const info = await this.credentialInfo();
    if (info.kind === 'failed') return info;
    const hashes = [Buffer.from(digest).toString('base64')];
    const common = { credentialID: this.config.credentialId, hashes, hashAlgorithmOID: OID.sha256 };
    const authorized = await this.call('credentials/authorize', { ...common, numSignatures: 1 });
    if (authorized.kind === 'failed') return authorized;
    const sad = record(authorized.value)?.SAD;
    if (typeof sad !== 'string' || sad.length === 0) return rejected('credentials/authorize: χωρίς SAD (απαιτεί PIN/OTP;)');
    const signed = await this.call('signatures/signHash', { ...common, SAD: sad, signAlgo: cscSignAlgorithm(algorithm, info.value.keyAlgorithms) });
    if (signed.kind === 'failed') return signed;
    const signatures = strings(record(signed.value)?.signatures);
    const signature = signatures?.length === 1 ? base64Bytes(signatures[0]) : null;
    return signature === null ? rejected('signatures/signHash: όχι ακριβώς μία αναγνώσιμη υπογραφή') : { kind: 'ok', value: signature };
  }
}

/** Μία συνεδρία ανά εκτέλεση: token και αλυσίδα κρατιούνται για όλες τις σφραγίσεις της. */
export function cscSealSigner(config: CscConfiguration, transport: SealTransport): SealSigner {
  return new CscSession(config, transport);
}
