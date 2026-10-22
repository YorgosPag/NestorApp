/**
 * @module server/pdf-seal/cms-primitives
 * @description **Τα κοινά ASN.1/CMS στοιχεία** του ελεγκτή (ADR-902) και του παραγωγού σφραγίδας (ADR-918).
 *
 * 🔑 Ελεγκτής και παραγωγός μιλούν **την ίδια** γλώσσα OID και την ίδια μηχανή κρυπτογραφίας — αν ο καθένας
 * κρατούσε δικό του αντίγραφο, μια διόρθωση στον έναν (π.χ. νέος αλγόριθμος) θα άφηνε τον άλλο να «συμφωνεί»
 * με κάτι που δεν υπάρχει πια. Γι' αυτό ζουν **εδώ, μία φορά** — ο αυτοέλεγχος πάει-και-έρχεται του ADR-918 έχει
 * νόημα μόνο αν οι δύο πλευρές διαβάζουν τα ίδια ονόματα.
 *
 * Εξάρτηση: `pkijs` + `asn1js` (BSD-3-Clause, N.5 ✅) πάνω στο WebCrypto του Node.
 */

import { createHash, webcrypto } from 'crypto';
import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';

export const CMS_ENGINE = new pkijs.CryptoEngine({ name: 'node-webcrypto', crypto: webcrypto as unknown as Crypto });

/** Οι σύνοψεις που δεχόμαστε. SHA-1 **δεν** υπάρχει εδώ, επίτηδες. */
export const DIGEST_ALGORITHMS: Readonly<Record<string, 'sha256' | 'sha384' | 'sha512'>> = {
  '2.16.840.1.101.3.4.2.1': 'sha256',
  '2.16.840.1.101.3.4.2.2': 'sha384',
  '2.16.840.1.101.3.4.2.3': 'sha512',
};

export const OID = {
  sha256: '2.16.840.1.101.3.4.2.1',
  data: '1.2.840.113549.1.7.1',
  contentType: '1.2.840.113549.1.9.3',
  messageDigest: '1.2.840.113549.1.9.4',
  signingTime: '1.2.840.113549.1.9.5',
  /** id-aa-signingCertificateV2 (RFC 5035) — η δέσμευση του πιστοποιητικού στην υπογραφή (PAdES B-B). */
  signingCertificateV2: '1.2.840.113549.1.9.16.2.47',
  /** id-aa-signatureTimeStampToken (RFC 3161 Παράρτημα A) — η χρονοσήμανση της υπογραφής (PAdES B-T). */
  timeStampToken: '1.2.840.113549.1.9.16.2.14',
  /** id-ct-TSTInfo. */
  tstInfo: '1.2.840.113549.1.9.16.1.4',
  rsaEncryption: '1.2.840.113549.1.1.1',
  sha256WithRsa: '1.2.840.113549.1.1.11',
  ecPublicKey: '1.2.840.10045.2.1',
  ecdsaWithSha256: '1.2.840.10045.4.3.2',
  commonName: '2.5.4.3',
  organization: '2.5.4.10',
  organizationIdentifier: '2.5.4.97',
} as const;

export function sha256(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(createHash('sha256').update(bytes).digest());
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Αντίγραφο σε **δικό του** `ArrayBuffer` — τα views του asn1js μοιράζονται buffer με όλο το DER. */
export function ownBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}

export function derOf(value: { toBER(sizeOnly?: boolean): ArrayBuffer }): Uint8Array {
  return new Uint8Array(value.toBER(false));
}

export function certificateDer(certificate: pkijs.Certificate): Uint8Array {
  return derOf(certificate.toSchema());
}

export function attributeValue(attrs: pkijs.SignedAndUnsignedAttributes | undefined, oid: string): asn1js.AsnType | null {
  const found = attrs?.attributes.find((attribute) => attribute.type === oid);
  return found?.values[0] ?? null;
}

/** `ContentInfo` → `SignedData`, ή `null` για ό,τι δεν είναι (ποτέ δεν ρίχνει). */
export function parseSignedData(der: Uint8Array): pkijs.SignedData | null {
  try {
    const asn1 = asn1js.fromBER(der);
    if (asn1.offset === -1) return null;
    const contentInfo = new pkijs.ContentInfo({ schema: asn1.result });
    if (contentInfo.contentType !== pkijs.ContentInfo.SIGNED_DATA) return null;
    return new pkijs.SignedData({ schema: contentInfo.content });
  } catch {
    return null;
  }
}

/** DER πιστοποιητικού → `Certificate`, ή `null`. */
export function parseCertificate(der: Uint8Array): pkijs.Certificate | null {
  try {
    const asn1 = asn1js.fromBER(der);
    return asn1.offset === -1 ? null : new pkijs.Certificate({ schema: asn1.result });
  } catch {
    return null;
  }
}
