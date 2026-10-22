/**
 * @module server/pdf-seal/rfc3161-timestamp.server
 * @description **Ο πελάτης χρονοσήμανσης RFC 3161** (ADR-918 §3.4) — η μαρτυρία **τρίτου** για το πότε υπήρχε η υπογραφή.
 *
 * ```
 * TimeStampReq { messageImprint: SHA-256(υπογραφή) · nonce: 64 bit τυχαίο · certReq: true }
 *   ─POST application/timestamp-query─► TSA ─► TimeStampResp { status · timeStampToken }
 * ```
 *
 * 🔴 **Ένα token που δεν ελέγξαμε είναι ένα token που κάποιος άλλος διάλεξε.** Πριν μπει στη σφραγίδα, πρέπει να
 * ισχύουν ΟΛΑ — αλλιώς `timestamp-mismatch`, ποτέ «περίπου»:
 * 1. `status` = granted (0) ή grantedWithMods (1)·
 * 2. `messageImprint` = SHA-256 **αυτής** της υπογραφής (όχι κάποιας άλλης — αντικατάσταση token)·
 * 3. `nonce` = **αυτό** που στείλαμε (επανάληψη παλιάς απάντησης / ενδιάμεσος)·
 * 4. η υπογραφή της TSA επαληθεύεται με το πιστοποιητικό **μέσα** στο token·
 * 5. `genTime` απέχει ≤ 5′ από το ρολόι μας (TSA με χαλασμένο ρολόι θα έκανε την απόδειξη ώρας άχρηστη).
 *
 * ⚠️ Η **εμπιστοσύνη** στην TSA (αλυσίδα προς EUTL) **δεν** κρίνεται εδώ — όπως και για τον υπογράφοντα, ανήκει στο
 * μητρώο εμπιστοσύνης (ADR-902) και στο B-LT (Σ7). Εδώ κρίνεται η **δέσμευση**: αυτό το token, γι' αυτή την υπογραφή, τώρα.
 * ⛔ **Ποτέ δωρεάν TSA (FreeTSA κ.λπ.) στην παραγωγή**: η χρονοσήμανση εγκεκριμένου παρόχου έχει τεκμήριο ακρίβειας (eIDAS άρθ. 41§2).
 */

import 'server-only';

import { randomBytes } from 'crypto';
import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';

import { bytesEqual, CMS_ENGINE, derOf, OID, ownBuffer, sha256 } from './cms-primitives';
import type { TsaConfiguration } from './seal-config.server';
import type { TimestampAuthority, TimestampOutcome } from './seal-signer.types';
import { postOnce, type SealTransport } from './seal-transport.server';

const MAX_CLOCK_SKEW_MS = 5 * 60_000;
const GRANTED = new Set([0, 1]);

const mismatch = (detail: string): TimestampOutcome => ({ kind: 'failed', reason: 'timestamp-mismatch', detail });

/** Θετικός ακέραιος 64 bit χωρίς μηδενικό πρώτο byte ⇒ μία μόνο κανονική κωδικοποίηση, συγκρίσιμη byte-προς-byte. */
function freshNonce(): Uint8Array {
  const bytes = new Uint8Array(randomBytes(8));
  bytes[0] = (bytes[0] & 0x7f) | 0x01;
  return bytes;
}

export function timestampRequestDer(imprint: Uint8Array, nonce: Uint8Array): Uint8Array {
  const request = new pkijs.TimeStampReq({
    version: 1,
    messageImprint: new pkijs.MessageImprint({
      hashAlgorithm: new pkijs.AlgorithmIdentifier({ algorithmId: OID.sha256, algorithmParams: new asn1js.Null() }),
      hashedMessage: new asn1js.OctetString({ valueHex: ownBuffer(imprint) }),
    }),
    nonce: new asn1js.Integer({ valueHex: ownBuffer(nonce) }),
    certReq: true,
  });
  return derOf(request.toSchema());
}

type ParsedResponse =
  | { readonly kind: 'parsed'; readonly token: pkijs.ContentInfo; readonly signedData: pkijs.SignedData; readonly tstInfo: pkijs.TSTInfo }
  | Extract<TimestampOutcome, { kind: 'failed' }>;

function parseResponse(body: Uint8Array): ParsedResponse {
  try {
    const response = new pkijs.TimeStampResp({ schema: asn1js.fromBER(ownBuffer(body)).result });
    const status = response.status.status;
    if (!GRANTED.has(status) || !response.timeStampToken) {
      return { kind: 'failed', reason: 'timestamp-rejected', detail: `PKIStatus ${status}` };
    }
    const signedData = new pkijs.SignedData({ schema: response.timeStampToken.content });
    const eContent = signedData.encapContentInfo.eContent;
    if (signedData.encapContentInfo.eContentType !== OID.tstInfo || !eContent) return mismatch('token χωρίς TSTInfo');
    const tstInfo = new pkijs.TSTInfo({ schema: asn1js.fromBER(eContent.getValue()).result });
    return { kind: 'parsed', token: response.timeStampToken, signedData, tstInfo };
  } catch {
    return { kind: 'failed', reason: 'timestamp-rejected', detail: 'σώμα που δεν είναι TimeStampResp' };
  }
}

/** Οι έλεγχοι 2–5. `null` = όλα αληθή. */
interface Expected {
  readonly signatureValue: Uint8Array;
  readonly imprint: Uint8Array;
  readonly nonce: Uint8Array;
  readonly now: Date;
}

async function bindingFailure(parsed: Extract<ParsedResponse, { kind: 'parsed' }>, expected: Expected): Promise<string | null> {
  const { imprint, nonce, now } = expected;
  const { tstInfo, signedData } = parsed;
  const imprintMatches =
    tstInfo.messageImprint.hashAlgorithm.algorithmId === OID.sha256 &&
    bytesEqual(tstInfo.messageImprint.hashedMessage.valueBlock.valueHexView, imprint);
  if (!imprintMatches) return 'messageImprint ≠ SHA-256 της υπογραφής';
  if (!tstInfo.nonce || !bytesEqual(tstInfo.nonce.valueBlock.valueHexView, nonce)) return 'nonce ≠ αυτό που στάλθηκε';
  if (Math.abs(tstInfo.genTime.getTime() - now.getTime()) > MAX_CLOCK_SKEW_MS) return `genTime ${tstInfo.genTime.toISOString()} εκτός ±5′`;
  try {
    // ⚠️ Για token TSTInfo το pkijs ΑΠΑΙΤΕΙ τα χρονοσημασμένα bytes (`data`) — χωρίς αυτά ρίχνει «Missed detached data».
    const verified = await signedData.verify({ signer: 0, checkChain: false, data: ownBuffer(expected.signatureValue) }, CMS_ENGINE);
    return verified === true ? null : 'η υπογραφή της TSA δεν επαληθεύεται';
  } catch {
    return 'η υπογραφή της TSA δεν επαληθεύεται (χωρίς πιστοποιητικό;)';
  }
}

function requestHeaders(config: TsaConfiguration): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/timestamp-query', Accept: 'application/timestamp-reply' };
  if (config.basicAuth !== null) {
    const { username, password } = config.basicAuth;
    headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }
  return headers;
}

/** Η θύρα `TimestampAuthority` πάνω σε μια πραγματική TSA. `nonceSource` εγχέεται μόνο από τις άγκυρες. */
export function rfc3161TimestampAuthority(
  config: TsaConfiguration,
  transport: SealTransport,
  nonceSource: () => Uint8Array = freshNonce,
): TimestampAuthority {
  return async (signatureValue) => {
    const imprint = sha256(signatureValue);
    const nonce = nonceSource();
    const call = await postOnce(transport, config.url, { headers: requestHeaders(config), body: timestampRequestDer(imprint, nonce) });
    if (call.kind === 'unavailable') return { kind: 'failed', reason: 'timestamp-unavailable', detail: call.detail };
    if (call.kind === 'rejected') return { kind: 'failed', reason: 'timestamp-rejected', detail: call.detail };
    const parsed = parseResponse(call.body);
    if (parsed.kind === 'failed') return parsed;
    const failure = await bindingFailure(parsed, { signatureValue, imprint, nonce, now: transport.now() });
    if (failure !== null) return mismatch(failure);
    return { kind: 'ok', token: derOf(parsed.token.toSchema()), genTime: parsed.tstInfo.genTime };
  };
}
