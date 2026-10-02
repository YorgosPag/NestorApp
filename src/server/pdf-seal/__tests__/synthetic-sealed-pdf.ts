/**
 * ADR-900 §3.8 — **Συνθετικό σφραγισμένο PDF** για τα tests του ελεγκτή σφραγίδας.
 *
 * Παράγεται **μέσα στο test** (κλειδί, πιστοποιητικό, PDF, υπογραφή) — κανένα πραγματικό έγγραφο, κανένα
 * προσωπικό δεδομένο, κανένα δυαδικό fixture στο repo. Το σχήμα είναι το ελάχιστο PAdES: `/ByteRange` +
 * `/Contents` με CMS `SignedData` (detached, signed attributes: contentType · messageDigest · signingTime).
 */
import { createHash, webcrypto } from 'crypto';
import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';

const ENGINE = new pkijs.CryptoEngine({ name: 'test-webcrypto', crypto: webcrypto as unknown as Crypto });

const CONTENTS_HEX_LENGTH = 16_384;
const NUMBER_WIDTH = 10;

export interface SyntheticSigner {
  readonly certificate: pkijs.Certificate;
  readonly privateKey: CryptoKey;
}

function attr(type: string, value: asn1js.AsnType): pkijs.AttributeTypeAndValue {
  return new pkijs.AttributeTypeAndValue({ type, value });
}

/** Αυτο-υπογεγραμμένο πιστοποιητικό με `organizationIdentifier` (eIDAS OID 2.5.4.97). */
export async function makeSigner(organizationIdentifier: string, validFrom: Date, validTo: Date): Promise<SyntheticSigner> {
  const keys = (await webcrypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const certificate = new pkijs.Certificate();
  certificate.version = 2;
  certificate.serialNumber = new asn1js.Integer({ value: 1 });
  for (const name of [certificate.subject, certificate.issuer]) {
    name.typesAndValues.push(attr('2.5.4.3', new asn1js.Utf8String({ value: 'SYNTHETIC SEAL' })));
    name.typesAndValues.push(attr('2.5.4.10', new asn1js.Utf8String({ value: 'SYNTHETIC ORG' })));
    name.typesAndValues.push(attr('2.5.4.97', new asn1js.Utf8String({ value: organizationIdentifier })));
  }
  certificate.notBefore.value = validFrom;
  certificate.notAfter.value = validTo;
  await certificate.subjectPublicKeyInfo.importKey(keys.publicKey, ENGINE);
  await certificate.sign(keys.privateKey, 'SHA-256', ENGINE);
  return { certificate, privateKey: keys.privateKey };
}

function pad(value: number): string {
  return String(value).padStart(NUMBER_WIDTH, '0');
}

/** PDF με κενό υπογραφής: επιστρέφει τα bytes και τα όρια του `/Contents`. */
function unsignedPdf(): { readonly text: string; readonly b: number; readonly c: number } {
  const head = '%PDF-1.7\n1 0 obj\n<< /Type /Sig /ByteRange [';
  const placeholder = `${pad(0)} ${pad(0)} ${pad(0)} ${pad(0)}`;
  const middle = '] /Contents <';
  const tail = '> >>\nendobj\nΣΥΝΘΕΤΙΚΟ ΠΚΑ — ΚΑΕΚ 050681726003/0/1\n%%EOF\n';
  const draft = head + placeholder + middle + '0'.repeat(CONTENTS_HEX_LENGTH) + tail;
  const b = (head + placeholder + middle).length - 1;
  const c = b + 1 + CONTENTS_HEX_LENGTH + 1;
  const text = draft.replace(placeholder, `${pad(0)} ${pad(b)} ${pad(c)} ${pad(Buffer.byteLength(draft, 'latin1') - c)}`);
  return { text, b, c };
}

/** Υπογράφει το συνθετικό PDF. `signingTime` = η δηλωμένη ώρα υπογραφής. */
export async function makeSealedPdf(signer: SyntheticSigner, signingTime: Date): Promise<Uint8Array> {
  const { text, b, c } = unsignedPdf();
  const pdf = new Uint8Array(Buffer.from(text, 'latin1'));
  const signed = new Uint8Array(b + (pdf.length - c));
  signed.set(pdf.subarray(0, b), 0);
  signed.set(pdf.subarray(c), b);
  const digest = new Uint8Array(createHash('sha256').update(signed).digest());

  const signerInfo = new pkijs.SignerInfo({
    version: 1,
    sid: new pkijs.IssuerAndSerialNumber({ issuer: signer.certificate.issuer, serialNumber: signer.certificate.serialNumber }),
    signedAttrs: new pkijs.SignedAndUnsignedAttributes({
      type: 0,
      attributes: [
        new pkijs.Attribute({ type: '1.2.840.113549.1.9.3', values: [new asn1js.ObjectIdentifier({ value: '1.2.840.113549.1.7.1' })] }),
        new pkijs.Attribute({ type: '1.2.840.113549.1.9.4', values: [new asn1js.OctetString({ valueHex: digest })] }),
        new pkijs.Attribute({ type: '1.2.840.113549.1.9.5', values: [new asn1js.UTCTime({ valueDate: signingTime })] }),
      ],
    }),
  });
  const signedData = new pkijs.SignedData({
    version: 1,
    encapContentInfo: new pkijs.EncapsulatedContentInfo({ eContentType: '1.2.840.113549.1.7.1' }),
    signerInfos: [signerInfo],
    certificates: [signer.certificate],
  });
  await signedData.sign(signer.privateKey, 0, 'SHA-256', undefined, ENGINE);
  const cms = new pkijs.ContentInfo({ contentType: pkijs.ContentInfo.SIGNED_DATA, content: signedData.toSchema(true) });
  const hex = Buffer.from(cms.toSchema().toBER(false)).toString('hex');
  if (hex.length > CONTENTS_HEX_LENGTH) throw new Error('συνθετικό: το CMS δεν χωρά στο κενό');
  pdf.set(Buffer.from(hex, 'latin1'), b + 1);
  return pdf;
}
