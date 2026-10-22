/**
 * @module server/pdf-seal/pdf-seal-placeholder
 * @description **Το κενό υπογραφής** (ADR-918 §3) — παίρνει ένα PDF που εκδώσαμε και ετοιμάζει τη θέση όπου θα
 * καθίσει η σφραγίδα PAdES. Καθαρό ως προς την κρυπτογραφία: δεν υπογράφει τίποτα.
 *
 * ```
 * pdf-lib: /Sig { /Filter /Adobe.PPKLite /SubFilter /ETSI.CAdES.detached /M (…) /ByteRange [0 b c d] /Contents <00…00> }
 *          + αόρατο widget (/FT /Sig, /F Print|Locked) + /AcroForm /SigFlags 3
 * ```
 *
 * 🔑 **Τρία πράγματα που πρέπει να είναι αλήθεια, και ο ελεγκτής (ADR-902 `signedRangesOf`) τα απαιτεί:**
 * 1. `/ByteRange` ξεκινά στο **0** και φτάνει ως το **τέλος** του αρχείου — καμία ουρά έξω από την υπογραφή·
 * 2. το κενό `[b, c)` είναι **ακριβώς** το `<…>` του `/Contents`·
 * 3. το `/ByteRange` γράφεται **σε σταθερό πλάτος** — αλλάζει τιμές, όχι μήκος, άρα δεν μετακινεί κανένα byte.
 *
 * PAdES baseline (ETSI EN 319 142-1 §6.3): `/SubFilter /ETSI.CAdES.detached` · η **δηλωμένη** ώρα πάει στο `/M`,
 * **όχι** σε ιδιότητα `signingTime` του CMS (απαγορεύεται στο B-B).
 *
 * ⚠️ `useObjectStreams: false`: το λεξικό υπογραφής πρέπει να είναι **κείμενο** στο αρχείο — μέσα σε συμπιεσμένο
 * object stream ούτε ο ελεγκτής μας ούτε το Adobe θα έβρισκαν το `/ByteRange`.
 */

import { PDFArray, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFString, type PDFDict } from 'pdf-lib';

import { joinSignedRanges } from './pdf-byte-range';
import type { SealPresentation } from './seal-signer.types';

/**
 * **Bytes** του κενού `/Contents` (στο αρχείο γράφεται το διπλάσιο, σε hex).
 *
 * Λογαριασμός (ADR-918 §3.2): αλυσίδα εγκεκριμένου παρόχου 3 πιστοποιητικά × ~1,9 KB ≈ 5,7 KB · token TSA με τη
 * δική του αλυσίδα ≈ 6–8 KB · υπογραφή RSA-4096 0,5 KB · ιδιότητες < 1 KB ⇒ ~16 KB. Διπλάσιο για περιθώριο
 * (αλυσίδες με ενδιάμεσα QCA, μεγαλύτερα κλειδιά). Ό,τι δεν χωρά ⇒ `contents-overflow`, ποτέ κομμένο CMS.
 */
export const SEAL_CONTENTS_BYTES = 32_768;

const BYTE_RANGE_WIDTH = 10;
const BYTE_RANGE_PLACEHOLDER = '*'.repeat(BYTE_RANGE_WIDTH);
const LATIN1 = new TextDecoder('latin1');
/** Print (4) + Locked (128): το widget τυπώνεται, και κανείς δεν το μετακινεί/σβήνει από το UI του αναγνώστη. */
const WIDGET_FLAGS = 132;
/** SignaturesExist (1) + AppendOnly (2) — ISO 32000-1 §12.7.2. */
const SIG_FLAGS = 3;

export interface PreparedSealPdf {
  /** Το PDF με το τελικό `/ByteRange` και μηδενικά στο `/Contents`. */
  readonly pdf: Uint8Array;
  /** Θέση του `<` του `/Contents`. */
  readonly b: number;
  /** Θέση αμέσως μετά το `>`. */
  readonly c: number;
  /** Τα bytes που θα υπογραφούν. */
  readonly signedBytes: Uint8Array;
}

export type PrepareOutcome =
  | { readonly kind: 'prepared'; readonly prepared: PreparedSealPdf }
  | { readonly kind: 'failed'; readonly reason: 'pdf-unreadable' | 'pdf-already-signed'; readonly detail: string };

function signatureDictionary(doc: PDFDocument, signedAt: Date, presentation: SealPresentation): PDFDict {
  const byteRange = PDFArray.withContext(doc.context);
  byteRange.push(PDFNumber.of(0));
  for (let i = 0; i < 3; i += 1) byteRange.push(PDFName.of(BYTE_RANGE_PLACEHOLDER));
  return doc.context.obj({
    Type: 'Sig',
    Filter: 'Adobe.PPKLite',
    SubFilter: 'ETSI.CAdES.detached',
    ByteRange: byteRange,
    Contents: PDFHexString.of('0'.repeat(SEAL_CONTENTS_BYTES * 2)),
    M: PDFString.fromDate(signedAt),
    Reason: PDFHexString.fromText(presentation.reason),
    Location: PDFHexString.fromText(presentation.location),
  });
}

/** Αόρατο πεδίο υπογραφής στην πρώτη σελίδα (σφραγίδα εγγράφου, όχι οπτική υπογραφή προσώπου). */
function attachSignatureField(doc: PDFDocument, signedAt: Date, presentation: SealPresentation): void {
  const signatureRef = doc.context.register(signatureDictionary(doc, signedAt, presentation));
  const page = doc.getPage(0);
  const widgetRef = doc.context.register(
    doc.context.obj({
      Type: 'Annot',
      Subtype: 'Widget',
      FT: 'Sig',
      Rect: [0, 0, 0, 0],
      V: signatureRef,
      T: PDFString.of('Seal1'),
      F: WIDGET_FLAGS,
      P: page.ref,
    }),
  );
  page.node.addAnnot(widgetRef);
  const acroForm = doc.catalog.getOrCreateAcroForm();
  acroForm.addField(widgetRef);
  acroForm.dict.set(PDFName.of('SigFlags'), PDFNumber.of(SIG_FLAGS));
}

async function loadFresh(pdf: Uint8Array): Promise<PDFDocument | PrepareOutcome> {
  if (LATIN1.decode(pdf).includes('/ByteRange')) {
    return { kind: 'failed', reason: 'pdf-already-signed', detail: 'το PDF έχει ήδη /ByteRange' };
  }
  try {
    const doc = await PDFDocument.load(pdf, { updateMetadata: false });
    if (doc.getPageCount() === 0) return { kind: 'failed', reason: 'pdf-unreadable', detail: 'PDF χωρίς σελίδες' };
    return doc;
  } catch (error) {
    return { kind: 'failed', reason: 'pdf-unreadable', detail: error instanceof Error ? error.message : String(error) };
  }
}

/** Βρίσκει **το ένα** κενό `/Contents` — δεύτερο ταίριασμα θα σήμαινε ότι δεν ξέρουμε ποιο υπογράφουμε. */
function locateContents(text: string): { readonly b: number; readonly c: number } | null {
  const marker = `<${'0'.repeat(SEAL_CONTENTS_BYTES * 2)}>`;
  const b = text.indexOf(marker);
  if (b === -1 || text.indexOf(marker, b + 1) !== -1) return null;
  return { b, c: b + marker.length };
}

/** Γράφει τις τελικές τιμές στο `/ByteRange` **χωρίς** να αλλάξει το μήκος του. */
function fillByteRange(bytes: Uint8Array, text: string, b: number, c: number): boolean {
  const key = text.indexOf('/ByteRange');
  const open = key === -1 ? -1 : text.indexOf('[', key);
  const close = open === -1 ? -1 : text.indexOf(']', open);
  if (close === -1 || text.indexOf('/ByteRange', key + 1) !== -1) return false;
  if (text.slice(open, close).split(`/${BYTE_RANGE_PLACEHOLDER}`).length !== 4) return false;
  const value = `[0 ${b} ${c} ${bytes.length - c}`;
  const width = close - open;
  if (value.length > width) return false;
  bytes.set(new TextEncoder().encode(value.padEnd(width, ' ')), open);
  return true;
}

/** Το βήμα 1 της σφράγισης: κενό υπογραφής + τελικό `/ByteRange` + τα bytes προς υπογραφή. */
export async function prepareSealPdf(pdf: Uint8Array, signedAt: Date, presentation: SealPresentation): Promise<PrepareOutcome> {
  const loaded = await loadFresh(pdf);
  if (!(loaded instanceof PDFDocument)) return loaded;
  attachSignatureField(loaded, signedAt, presentation);
  const bytes = await loaded.save({ useObjectStreams: false, updateFieldAppearances: false });
  const text = LATIN1.decode(bytes);
  const contents = locateContents(text);
  if (contents === null || !fillByteRange(bytes, text, contents.b, contents.c)) {
    return { kind: 'failed', reason: 'pdf-unreadable', detail: 'το κενό υπογραφής δεν εντοπίστηκε μονοσήμαντα' };
  }
  return { kind: 'prepared', prepared: { pdf: bytes, ...contents, signedBytes: joinSignedRanges(bytes, contents.b, contents.c) } };
}

/** Το τελευταίο βήμα: το CMS μπαίνει στο κενό. Μεγαλύτερο από το κενό ⇒ `null` (ποτέ κομμένο). */
export function embedCms(prepared: PreparedSealPdf, cms: Uint8Array): Uint8Array | null {
  if (cms.length > SEAL_CONTENTS_BYTES) return null;
  const out = prepared.pdf.slice();
  out.set(new TextEncoder().encode(Buffer.from(cms).toString('hex')), prepared.b + 1);
  return out;
}
