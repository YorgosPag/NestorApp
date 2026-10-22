/**
 * @module server/pdf-seal/verify-pdf-seal
 * @description **Ο ελεγκτής σφραγίδας PDF (PAdES)** — ADR-900 §3.8. Το κεντρικό σύστημα· ο πρώτος
 * καταναλωτής είναι το ΠΚΑ του Κτηματολογίου, αλλά δεν ξέρει τίποτα γι' αυτό (επαναχρησιμοποιήσιμο για
 * κάθε έγγραφο με εγκεκριμένη σφραγίδα eIDAS: gov.gr, e-ΕΦΚΑ, ΓΕΜΗ…).
 *
 * Βήματα — ίδια σειρά με EU DSS / Adobe:
 * 1. **Τι υπογράφηκε** (`pdf-byte-range.ts`): ByteRange από το 0 ως το τέλος, κενό = μόνο το `/Contents`.
 * 2. **Αλγόριθμος**: SHA-256/384/512 μόνο· SHA-1 ⇒ `unsupported-algorithm` (ποτέ «περνάει»).
 * 3. **Αναλλοίωτο**: `messageDigest` του υπογράφοντος = hash των υπογεγραμμένων bytes (υπολογισμένο ΕΔΩ).
 * 4. **Υπογραφή**: το `SignedData` επαληθεύεται με το πιστοποιητικό του υπογράφοντος (`pkijs`).
 * 5. **Ώρα**: χρονοσήμανση RFC 3161 αν υπάρχει **και** επαληθεύεται (messageImprint = hash της υπογραφής),
 *    αλλιώς το δηλωμένο `signingTime` (με `timestamped: false`).
 * 6. **Ισχύς**: το πιστοποιητικό ίσχυε τη στιγμή της υπογραφής.
 * 7. **Αλυσίδα**: προς τις ρίζες του μητρώου (`config/trust/pdf-seal-trust.ts`) — χωριστό πεδίο, ΟΧΙ άκυρο.
 *
 * Εξάρτηση: `pkijs` + `asn1js` (BSD-3-Clause, N.5 ✅) πάνω στο WebCrypto του Node — καμία εγγενής βιβλιοθήκη.
 * Τα OID/μηχανή/αναλυτές ζουν στο `cms-primitives.ts`, κοινά με τον παραγωγό σφραγίδας (ADR-918).
 */

import 'server-only';

import { createHash } from 'crypto';
import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';

import { PDF_SEAL_TRUST_ANCHORS } from '@/config/trust/pdf-seal-trust';
import {
  attributeValue,
  bytesEqual,
  certificateDer,
  CMS_ENGINE as ENGINE,
  DIGEST_ALGORITHMS as DIGESTS,
  OID,
  parseSignedData,
  sha256Hex,
} from './cms-primitives';
import { signedRangesOf } from './pdf-byte-range';
import type { PdfSealSigner, PdfSealVerdict, PdfSealVerifier } from './pdf-seal.types';

const invalid = (reason: Extract<PdfSealVerdict, { kind: 'invalid' }>['reason']): PdfSealVerdict => ({ kind: 'invalid', reason });

function subjectValue(certificate: pkijs.Certificate, oid: string): string | null {
  const entry = certificate.subject.typesAndValues.find((value) => value.type === oid);
  const raw = entry?.value.valueBlock.value;
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

function signerOf(certificate: pkijs.Certificate): PdfSealSigner {
  return {
    commonName: subjectValue(certificate, OID.commonName),
    organization: subjectValue(certificate, OID.organization),
    organizationIdentifier: subjectValue(certificate, OID.organizationIdentifier),
    certificateSha256: sha256Hex(certificateDer(certificate)),
  };
}

/** Η χρονοσήμανση RFC 3161 — `Date` μόνο αν το token επαληθεύεται **και** δένει με αυτή την υπογραφή. */
async function timestampOf(signerInfo: pkijs.SignerInfo): Promise<Date | null> {
  const token = attributeValue(signerInfo.unsignedAttrs, OID.timeStampToken);
  if (token === null) return null;
  try {
    const tokenData = parseSignedData(new Uint8Array(token.toBER(false)));
    const eContent = tokenData?.encapContentInfo.eContent;
    if (!tokenData || !eContent) return null;
    const tstInfo = new pkijs.TSTInfo({ schema: asn1js.fromBER(eContent.getValue()).result });
    const signatureValue = signerInfo.signature.valueBlock.valueHexView;
    const imprintOk = await tstInfo.verify({ data: signatureValue.slice().buffer }, ENGINE);
    // ⚠️ ADR-918 εύρημα (21/10): για TSTInfo το pkijs ΑΠΑΙΤΕΙ το `data` — χωρίς αυτό ρίχνει, το catch έδινε `null`,
    // και ΚΑΘΕ γνήσια χρονοσήμανση διαβαζόταν «χωρίς χρονοσήμανση». Αόρατο ως τότε: το fixture δεν είχε TSA.
    const tokenOk = await tokenData.verify({ signer: 0, checkChain: false, data: signatureValue.slice().buffer }, ENGINE);
    return imprintOk && tokenOk ? tstInfo.genTime : null;
  } catch {
    return null;
  }
}

function declaredSigningTime(signerInfo: pkijs.SignerInfo): Date | null {
  const value = attributeValue(signerInfo.signedAttrs, OID.signingTime);
  if (value instanceof asn1js.UTCTime || value instanceof asn1js.GeneralizedTime) return value.toDate();
  return null;
}

async function chainTrusted(signedData: pkijs.SignedData, signer: pkijs.Certificate, at: Date | null): Promise<boolean> {
  if (PDF_SEAL_TRUST_ANCHORS.length === 0) return false;
  try {
    const trustedCerts = PDF_SEAL_TRUST_ANCHORS.map((anchor) => pkijs.Certificate.fromBER(pemToDer(anchor.pem)));
    const certs = (signedData.certificates ?? []).filter((c): c is pkijs.Certificate => c instanceof pkijs.Certificate);
    const engine = new pkijs.CertificateChainValidationEngine({ trustedCerts, certs: [signer, ...certs], checkDate: at ?? new Date() });
    return (await engine.verify(undefined, ENGINE)).result === true;
  } catch {
    return false;
  }
}

function pemToDer(pem: string): ArrayBuffer {
  const base64 = pem.replace(/-----(BEGIN|END) CERTIFICATE-----/g, '').replace(/\s+/g, '');
  return new Uint8Array(Buffer.from(base64, 'base64')).buffer;
}

/** Βήματα 2-4: αλγόριθμος, αναλλοίωτο, υπογραφή. Επιστρέφει τον υπογράφοντα ή τον λόγο αποτυχίας. */
async function verifyIntegrity(
  signedData: pkijs.SignedData,
  signedBytes: Uint8Array,
): Promise<{ readonly signer: pkijs.Certificate } | { readonly failure: PdfSealVerdict }> {
  const signerInfo = signedData.signerInfos[0];
  const digest = DIGESTS[signerInfo.digestAlgorithm.algorithmId];
  if (digest === undefined) return { failure: invalid('unsupported-algorithm') };

  const declared = attributeValue(signerInfo.signedAttrs, OID.messageDigest);
  const actual = new Uint8Array(createHash(digest).update(signedBytes).digest());
  if (!(declared instanceof asn1js.OctetString) || !bytesEqual(declared.valueBlock.valueHexView, actual)) {
    return { failure: invalid('digest-mismatch') };
  }
  try {
    const result = await signedData.verify(
      { signer: 0, data: signedBytes.slice().buffer, checkChain: false, extendedMode: true },
      ENGINE,
    );
    if (!result.signatureVerified || !result.signerCertificate) return { failure: invalid('signature-invalid') };
    return { signer: result.signerCertificate };
  } catch {
    return { failure: invalid('signature-invalid') };
  }
}

/** Ο ελεγκτής. Ποτέ δεν ρίχνει για κακόβουλη είσοδο: κάθε αποτυχία έχει όνομα. */
export const verifyPdfSeal: PdfSealVerifier = async (pdf) => {
  const ranges = signedRangesOf(pdf);
  if (ranges.kind === 'failed') return invalid(ranges.reason);

  const signedData = parseSignedData(ranges.cms);
  if (signedData === null || signedData.signerInfos.length === 0) return invalid('malformed-cms');

  const integrity = await verifyIntegrity(signedData, ranges.signedBytes);
  if ('failure' in integrity) return integrity.failure;

  const signerInfo = signedData.signerInfos[0];
  const stamped = await timestampOf(signerInfo);
  const signedAt = stamped ?? declaredSigningTime(signerInfo);
  const { notBefore, notAfter } = integrity.signer;
  if (signedAt !== null && (signedAt < notBefore.value || signedAt > notAfter.value)) {
    return invalid('certificate-not-valid-at-signing');
  }

  return {
    kind: 'valid',
    signer: signerOf(integrity.signer),
    signedAt: signedAt === null ? null : signedAt.toISOString(),
    timestamped: stamped !== null,
    chainTrusted: await chainTrusted(signedData, integrity.signer, signedAt),
  };
};
