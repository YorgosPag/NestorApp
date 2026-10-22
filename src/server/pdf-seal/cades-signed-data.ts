/**
 * @module server/pdf-seal/cades-signed-data
 * @description **Η υπογραφή CAdES** μέσα στη σφραγίδα PAdES (ADR-918 §3.3) — CMS `SignedData`, detached.
 *
 * ```
 * signedAttrs = { contentType: id-data · messageDigest: SHA-256(signedBytes) · signingCertificateV2: SHA-256(φύλλο) + issuerSerial }
 *   ─► DER (SET OF, ταξινομημένο) ─► SHA-256 ─► θύρα SealSigner (CSC signHash) ─► υπογραφή
 *   ─► TSA(υπογραφή) ─► unsignedAttrs = { signatureTimeStampToken }   ⇒ PAdES B-T
 * ```
 *
 * 🔑 **Τι ΔΕΝ μπαίνει, επίτηδες** (ETSI EN 319 142-1 §6.3 · EN 319 122-1):
 * - `signingTime` — απαγορεύεται στο PAdES baseline· η δηλωμένη ώρα είναι το `/M` του λεξικού, η **αποδεικτική**
 *   ώρα είναι η χρονοσήμανση.
 * - `signingCertificate` (v1, SHA-1) — **μόνο** το v2· με τα δύο, το baseline απορρίπτεται.
 *
 * ⚠️ **Το SET OF πρέπει να είναι DER, δηλαδή ταξινομημένο** (X.690 §11.6): η σύνοψη που υπογράφεται είναι η
 * σύνοψη αυτών των bytes. Ένας αυστηρός ελεγκτής (EU DSS) που ξανακωδικοποιεί σε DER θα έβρισκε άλλη σύνοψη.
 */

import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';

import { compareBytes } from '@/lib/string/byte-order';

import { certificateDer, derOf, OID, sha256 } from './cms-primitives';
import type { SealSignatureAlgorithm } from './seal-signer.types';

const CURVE_COORDINATE_BYTES: Readonly<Record<string, number>> = {
  '1.2.840.10045.3.1.7': 32, // P-256
  '1.3.132.0.34': 48, // P-384
};

const SIGNATURE_ALGORITHM_OID: Readonly<Record<SealSignatureAlgorithm, string>> = {
  'rsa-pkcs1-sha256': OID.sha256WithRsa,
  'ecdsa-sha256': OID.ecdsaWithSha256,
};

function attribute(type: string, value: asn1js.AsnType): pkijs.Attribute {
  return new pkijs.Attribute({ type, values: [value] });
}

/** `SigningCertificateV2 ::= SEQUENCE { certs SEQUENCE OF ESSCertIDv2 }` — SHA-256 είναι η προεπιλογή, άρα παραλείπεται. */
function signingCertificateV2(leaf: pkijs.Certificate): asn1js.Sequence {
  const issuerSerial = new pkijs.IssuerSerial({
    issuer: new pkijs.GeneralNames({ names: [new pkijs.GeneralName({ type: 4, value: leaf.issuer })] }),
    serialNumber: leaf.serialNumber,
  });
  const essCertId = new asn1js.Sequence({
    value: [new asn1js.OctetString({ valueHex: sha256(certificateDer(leaf)) }), issuerSerial.toSchema()],
  });
  return new asn1js.Sequence({ value: [new asn1js.Sequence({ value: [essCertId] })] });
}

/** Οι υπογεγραμμένες ιδιότητες PAdES B-B, ταξινομημένες κατά DER. */
export function buildSignedAttributes(signedBytes: Uint8Array, leaf: pkijs.Certificate): pkijs.SignedAndUnsignedAttributes {
  const attributes = [
    attribute(OID.contentType, new asn1js.ObjectIdentifier({ value: OID.data })),
    attribute(OID.messageDigest, new asn1js.OctetString({ valueHex: sha256(signedBytes) })),
    attribute(OID.signingCertificateV2, signingCertificateV2(leaf)),
  ].sort((a, b) => compareBytes(derOf(a.toSchema()), derOf(b.toSchema())));
  return new pkijs.SignedAndUnsignedAttributes({ type: 0, attributes });
}

/** Η σύνοψη που **υπογράφεται**: SHA-256 του DER των ιδιοτήτων με ετικέτα SET (0x31), όχι [0] (RFC 5652 §5.4). */
export function signedAttributesDigest(attrs: pkijs.SignedAndUnsignedAttributes): Uint8Array {
  const der = derOf(attrs.toSchema());
  der[0] = 0x31;
  return sha256(der);
}

/** Ο αλγόριθμος από το κλειδί του φύλλου — ό,τι δεν αναγνωρίζουμε ⇒ `null` (`unsupported-key-algorithm`). */
export function signatureAlgorithmOf(leaf: pkijs.Certificate): SealSignatureAlgorithm | null {
  const { algorithmId, algorithmParams } = leaf.subjectPublicKeyInfo.algorithm;
  if (algorithmId === OID.rsaEncryption) return 'rsa-pkcs1-sha256';
  if (algorithmId !== OID.ecPublicKey || !(algorithmParams instanceof asn1js.ObjectIdentifier)) return null;
  return CURVE_COORDINATE_BYTES[algorithmParams.valueBlock.toString()] === undefined ? null : 'ecdsa-sha256';
}

function unsignedInteger(bytes: Uint8Array): asn1js.Integer {
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0) start += 1;
  const trimmed = bytes.subarray(start);
  const content = trimmed[0] >= 0x80 ? new Uint8Array([0, ...trimmed]) : trimmed;
  return new asn1js.Integer({ valueHex: content.slice().buffer });
}

function isStrictEcdsaDer(bytes: Uint8Array): boolean {
  if (bytes[0] !== 0x30) return false;
  const parsed = asn1js.fromBER(bytes.slice().buffer);
  if (parsed.offset !== bytes.length || !(parsed.result instanceof asn1js.Sequence)) return false;
  const parts = parsed.result.valueBlock.value;
  return parts.length === 2 && parts.every((part) => part instanceof asn1js.Integer);
}

/**
 * Το CMS θέλει ECDSA ως DER `Ecdsa-Sig-Value` (RFC 5753)· οι πάροχοι CSC επιστρέφουν **είτε** DER **είτε** ωμό
 * `r‖s` (μετρημένο: BankID/Aloaha ωμό). Δεχόμαστε και τα δύο, βγάζουμε πάντα DER· ό,τι άλλο ⇒ `null`.
 */
export function cmsSignatureValue(signature: Uint8Array, algorithm: SealSignatureAlgorithm, leaf: pkijs.Certificate): Uint8Array | null {
  if (algorithm === 'rsa-pkcs1-sha256') return signature.length > 0 ? signature : null;
  if (isStrictEcdsaDer(signature)) return signature;
  const params = leaf.subjectPublicKeyInfo.algorithm.algorithmParams;
  const size = params instanceof asn1js.ObjectIdentifier ? CURVE_COORDINATE_BYTES[params.valueBlock.toString()] : undefined;
  if (size === undefined || signature.length !== size * 2) return null;
  return derOf(new asn1js.Sequence({ value: [unsignedInteger(signature.subarray(0, size)), unsignedInteger(signature.subarray(size))] }));
}

export interface SignedDataParts {
  readonly attrs: pkijs.SignedAndUnsignedAttributes;
  readonly signature: Uint8Array;
  readonly algorithm: SealSignatureAlgorithm;
  /** Φύλλο πρώτο. */
  readonly chain: readonly pkijs.Certificate[];
  /** Το token RFC 3161 (`ContentInfo` DER) — `null` μόνο για το εσωτερικό βήμα πριν τη χρονοσήμανση. */
  readonly timestampToken: Uint8Array | null;
}

function signerInfoOf(parts: SignedDataParts): pkijs.SignerInfo {
  const leaf = parts.chain[0];
  const signerInfo = new pkijs.SignerInfo({
    version: 1,
    sid: new pkijs.IssuerAndSerialNumber({ issuer: leaf.issuer, serialNumber: leaf.serialNumber }),
    digestAlgorithm: new pkijs.AlgorithmIdentifier({ algorithmId: OID.sha256, algorithmParams: new asn1js.Null() }),
    signedAttrs: parts.attrs,
    signatureAlgorithm: new pkijs.AlgorithmIdentifier({
      algorithmId: SIGNATURE_ALGORITHM_OID[parts.algorithm],
      ...(parts.algorithm === 'rsa-pkcs1-sha256' ? { algorithmParams: new asn1js.Null() } : {}),
    }),
    signature: new asn1js.OctetString({ valueHex: parts.signature.slice().buffer }),
  });
  if (parts.timestampToken !== null) {
    const token = asn1js.fromBER(parts.timestampToken.slice().buffer).result;
    signerInfo.unsignedAttrs = new pkijs.SignedAndUnsignedAttributes({ type: 1, attributes: [attribute(OID.timeStampToken, token)] });
  }
  return signerInfo;
}

/** Το τελικό `ContentInfo { SignedData }` σε DER — αυτό μπαίνει στο `/Contents`. */
export function encodeSignedData(parts: SignedDataParts): Uint8Array {
  const signedData = new pkijs.SignedData({
    version: 1,
    digestAlgorithms: [new pkijs.AlgorithmIdentifier({ algorithmId: OID.sha256, algorithmParams: new asn1js.Null() })],
    encapContentInfo: new pkijs.EncapsulatedContentInfo({ eContentType: OID.data }),
    certificates: [...parts.chain],
    signerInfos: [signerInfoOf(parts)],
  });
  const contentInfo = new pkijs.ContentInfo({ contentType: pkijs.ContentInfo.SIGNED_DATA, content: signedData.toSchema(true) });
  return derOf(contentInfo.toSchema());
}
