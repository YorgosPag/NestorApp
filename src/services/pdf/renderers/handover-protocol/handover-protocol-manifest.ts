/**
 * @fileoverview **ΤΟ `manifest.json` ΤΟΥ ΠΡΩΤΟΚΟΛΛΟΥ** — ο πίνακας σε μηχαναγνώσιμη μορφή, **μέσα** στο σφραγισμένο PDF
 *               (ADR-916 Φ-Γ2 Σ4).
 * @module services/pdf/renderers/handover-protocol/handover-protocol-manifest
 * @related handover-protocol-view.ts (η ΜΙΑ όψη) · server/pdf-seal (η σφραγίδα καλύπτει και το συνημμένο)
 *
 * 🔑 **Γιατί συνημμένο και όχι χωριστό αρχείο**: η σφραγίδα PAdES καλύπτει **κάθε byte** του PDF, άρα και το συνημμένο
 *    (PDF/A-3 «associated file», `AFRelationship /Data`). Ο τρίτος παίρνει πίνακα **και** απόδειξη ακεραιότητάς του σε ένα
 *    αρχείο, χωρίς να εμπιστευτεί δεύτερο κανάλι. Ένα χωριστό JSON θα ήταν αφύλακτο.
 * 🔑 **Ντετερμινιστικό**: σταθερή σειρά κλειδιών (εδώ, ρητά) · δύο κενά εσοχή · LF στο τέλος · χρόνοι του συνημμένου =
 *    ο χρόνος έκδοσης. Ίδια όψη ⇒ ίδια bytes ⇒ το test μπορεί να συγκρίνει αυτολεξεί.
 * 🔒 Ίδια ελαχιστοποίηση με το PDF: ο παραλήπτης είναι **μόνο** ονοματεπώνυμο (ρήτρα `personalData`).
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

import { handoverDeliveryDigestSchemeOf } from '@/lib/property-handover/handover-delivery-plan';
// Ο αναγνώστης (Σ6) κατέχει την ετικέτα: γραφέας και αναγνώστης δεν μπορούν να διαφωνήσουν στο σχήμα.
import {
  HANDOVER_PROTOCOL_MANIFEST_SCHEME,
  handoverProtocolManifestSchemeOf,
} from '@/lib/property-handover/handover-protocol-manifest-parse';
import { HANDOVER_PROTOCOL_LEGAL_DOCUMENT } from '@/lib/property-handover/handover-protocol-terms';

import type { HandoverProtocolView } from './handover-protocol-view';

/** Το όνομα του συνημμένου — σταθερό: ο τρίτος το ψάχνει με αυτό. */
export const HANDOVER_PROTOCOL_MANIFEST_NAME = 'manifest.json';

const UTF8 = new TextEncoder();

/** Η γραμμή `C|…` της συνταγής v3 — δηλώνεται στο manifest δίπλα στη γραμμή των αποδεδειγμένων. */
const CLOSED_LINE_RECIPE = 'C|sourceFileId|copyFileId|crc32c|size|cause';

/**
 * Το `delivery` — v1 **αυτολεξεί** όταν δεν υπάρχουν κλεισμένες γραμμές· αλλιώς (Φ-Δ.7γ) ετικέτα v3, η συνταγή των κλεισμένων
 * και η λίστα `closed`, **χωριστή** από τα `files` (BagIt: τα `files` μένουν αυτοτελώς επαληθεύσιμα).
 */
function deliveryOf(view: HandoverProtocolView) {
  const files = view.rows.map((row) => ({ sourceFileId: row.sourceFileId, copyFileId: row.copyFileId, sha256: row.sha256, size: row.size, name: row.name }));
  const base = { scheme: handoverDeliveryDigestSchemeOf(view.closed.length), line: 'sourceFileId|copyFileId|sha256|size' };
  if (view.closed.length === 0) return { ...base, digest: view.ledgerDigest, totalBytes: view.totalBytes, files };
  const closed = view.closed.map((row) => ({
    sourceFileId: row.sourceFileId, copyFileId: row.copyFileId, crc32c: row.crc32c, size: row.size, cause: row.cause,
    deliveredAt: row.deliveredAt, name: row.name,
  }));
  return { ...base, closedLine: CLOSED_LINE_RECIPE, digest: view.ledgerDigest, totalBytes: view.totalBytes, files, closed };
}

/** **Το manifest** — κάθε αντικείμενο γράφεται με **ρητή** σειρά κλειδιών (το `base` κρατά πρώτα `scheme`, `line`). */
export function handoverProtocolManifestOf(view: HandoverProtocolView): string {
  const manifest = {
    schema: handoverProtocolManifestSchemeOf(view.closed.length),
    protocol: {
      id: view.protocolId,
      revision: view.revision,
      supersedes: view.supersedes === null ? null : { id: view.supersedes.protocolId, revision: view.supersedes.revision },
      issuedAt: view.issuedAt,
    },
    issuer: { name: view.issuerName },
    property: { label: view.propertyLabel, appurtenances: view.appurtenances },
    recipient: { name: view.recipientName },
    events: {
      saleCompletedAt: view.events.saleCompletedAt,
      invitationAcceptedAt: view.events.invitationAcceptedAt,
      deliveryStartedAt: view.events.deliveryStartedAt,
      deliveryCompletedAt: view.events.deliveryCompletedAt,
    },
    legalText: { document: HANDOVER_PROTOCOL_LEGAL_DOCUMENT, version: view.legalText.version, digest: view.legalText.digest, path: view.legalText.path },
    delivery: deliveryOf(view),
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/** **Επισυνάπτει** το manifest (PDF/A-3 associated file). ⚠️ Μόνο **πριν** τη σφράγιση: ό,τι προστεθεί μετά τη σπάει. */
export async function attachHandoverProtocolManifest(
  pdf: Uint8Array,
  manifest: string,
  issuedAt: Date,
  /** Φ-Δ.7γ — η ετικέτα του manifest που επισυνάπτεται (`handoverProtocolManifestSchemeOf`)· v1 ⇒ PDF ίδιο με πριν. */
  scheme: string = HANDOVER_PROTOCOL_MANIFEST_SCHEME,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf, { updateMetadata: false });
  await doc.attach(UTF8.encode(manifest), HANDOVER_PROTOCOL_MANIFEST_NAME, {
    mimeType: 'application/json',
    description: scheme,
    creationDate: issuedAt,
    modificationDate: issuedAt,
    afRelationship: AFRelationship.Data,
  });
  return doc.save({ useObjectStreams: false });
}

const nameOf = (value: unknown): string | null =>
  value instanceof PDFString || value instanceof PDFHexString ? value.decodeText() : null;

/** Το ζεύγος `[όνομα, filespec]` του δέντρου ονομάτων `EmbeddedFiles` με το όνομα του manifest — ή `null`. */
function manifestFileSpec(doc: PDFDocument): PDFDict | null {
  const names = doc.catalog.lookupMaybe(PDFName.of('Names'), PDFDict);
  const embedded = names?.lookupMaybe(PDFName.of('EmbeddedFiles'), PDFDict);
  const pairs = embedded?.lookupMaybe(PDFName.of('Names'), PDFArray);
  if (pairs === undefined) return null;
  for (let i = 0; i + 1 < pairs.size(); i += 2) {
    if (nameOf(pairs.lookup(i)) === HANDOVER_PROTOCOL_MANIFEST_NAME) return pairs.lookupMaybe(i + 1, PDFDict) ?? null;
  }
  return null;
}

/** **Διαβάζει** το manifest από ένα PDF — ό,τι θα έκανε ο τρίτος. `null` ⇒ δεν υπάρχει ή δεν διαβάζεται. */
export async function readHandoverProtocolManifest(pdf: Uint8Array): Promise<string | null> {
  const doc = await PDFDocument.load(pdf, { updateMetadata: false });
  const stream = manifestFileSpec(doc)?.lookupMaybe(PDFName.of('EF'), PDFDict)?.lookupMaybe(PDFName.of('F'), PDFRawStream);
  if (stream === undefined) return null;
  return new TextDecoder('utf-8', { fatal: true }).decode(decodePDFRawStream(stream).decode());
}
