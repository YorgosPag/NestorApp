/**
 * @fileoverview **ΤΟ ΜΗΧΑΝΑΓΝΩΣΙΜΟ ΣΥΝΗΜΜΕΝΟ ΕΝΟΣ PDF** — PDF/A-3 «associated file» (`AFRelationship /Data`): το έγγραφο
 *               κουβαλά τα δεδομένα του **μέσα** του, ώστε ο τρίτος να μη χρειάζεται δεύτερο κανάλι (ADR-916 Φ-Γ2 Σ4 ·
 *               ADR-947 Φ2β).
 * @module services/pdf/pdf-associated-file
 * @related services/pdf/pdf-deterministic-identity.ts · renderers/handover-protocol/handover-protocol-manifest.ts ·
 *   renderers/objective-value/objective-value-pdf.server.ts
 *
 * 🏆 **Πρότυπο ZUGFeRD / Factur-X (EN 16931)**: το τιμολόγιο είναι PDF/A-3 για τον άνθρωπο **και** XML συνημμένο για τη
 *    μηχανή — το ίδιο αρχείο, χωρίς να μπορούν να διαφωνήσουν. Εδώ το συνημμένο είναι JSON.
 * 🔑 **Ντετερμινιστικό**: οι χρόνοι του συνημμένου είναι ο χρόνος **του εγγράφου** (ποτέ «τώρα») και το `save` χωρίς
 *    object streams ⇒ ίδια είσοδος, ίδια bytes.
 * ⚠️ Σε PDF που θα **σφραγιστεί**, η επισύναψη γίνεται **πριν** τη σφράγιση: ό,τι προστεθεί μετά τη σπάει.
 * 🔑 Ήταν γραμμένο μέσα στο Πρωτόκολλο παράδοσης· ο δεύτερος καταναλωτής το έκανε υποδομή (N.0.2) — ένας γραφέας, ένας
 *    αναγνώστης, κανένα δίδυμο.
 */

import {
  AFRelationship,
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFString,
} from 'pdf-lib';

const UTF8 = new TextEncoder();

/** Ένα κειμενικό συνημμένο — το όνομα είναι η **διεύθυνσή** του: ο τρίτος το ψάχνει με αυτό. */
interface PdfAssociatedTextFile {
  readonly name: string;
  readonly text: string;
  readonly mimeType: string;
  /** Ετικέτα σχήματος (π.χ. `nestor.objective-value-snapshot/v1`) — ο αναγνώστης ξέρει τι διαβάζει πριν το ανοίξει. */
  readonly description: string;
  /** Ο χρόνος του **εγγράφου** — δημιουργία και τροποποίηση του συνημμένου. */
  readonly at: Date;
}

/** **Επισυνάπτει** κειμενικό αρχείο (PDF/A-3 associated file, `Data`). Επιστρέφει νέα bytes. */
export async function attachPdfTextFile(pdf: Uint8Array, file: PdfAssociatedTextFile): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf, { updateMetadata: false });
  await doc.attach(UTF8.encode(file.text), file.name, {
    mimeType: file.mimeType,
    description: file.description,
    creationDate: file.at,
    modificationDate: file.at,
    afRelationship: AFRelationship.Data,
  });
  return doc.save({ useObjectStreams: false });
}

const nameOf = (value: unknown): string | null =>
  value instanceof PDFString || value instanceof PDFHexString ? value.decodeText() : null;

/** Το filespec του δέντρου ονομάτων `EmbeddedFiles` με αυτό το όνομα — ή `null`. */
function fileSpecNamed(doc: PDFDocument, name: string): PDFDict | null {
  const names = doc.catalog.lookupMaybe(PDFName.of('Names'), PDFDict);
  const embedded = names?.lookupMaybe(PDFName.of('EmbeddedFiles'), PDFDict);
  const pairs = embedded?.lookupMaybe(PDFName.of('Names'), PDFArray);
  if (pairs === undefined) return null;
  for (let i = 0; i + 1 < pairs.size(); i += 2) {
    if (nameOf(pairs.lookup(i)) === name) return pairs.lookupMaybe(i + 1, PDFDict) ?? null;
  }
  return null;
}

/** **Διαβάζει** ένα κειμενικό συνημμένο (UTF-8, αυστηρά) — ό,τι θα έκανε ο τρίτος. `null` ⇒ δεν υπάρχει ή δεν διαβάζεται. */
export async function readPdfTextFile(pdf: Uint8Array, name: string): Promise<string | null> {
  const doc = await PDFDocument.load(pdf, { updateMetadata: false });
  const stream = fileSpecNamed(doc, name)?.lookupMaybe(PDFName.of('EF'), PDFDict)?.lookupMaybe(PDFName.of('F'), PDFRawStream);
  if (stream === undefined) return null;
  return new TextDecoder('utf-8', { fatal: true }).decode(decodePDFRawStream(stream).decode());
}
