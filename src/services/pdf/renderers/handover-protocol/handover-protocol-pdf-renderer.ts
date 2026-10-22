/**
 * @fileoverview **Η ΑΠΟΔΟΣΗ ΤΟΥ ΠΡΩΤΟΚΟΛΛΟΥ** — όψη → bytes PDF, **ασφράγιστα** (ADR-916 Φ-Γ2 Σ4).
 * @module services/pdf/renderers/handover-protocol/handover-protocol-pdf-renderer
 * @related handover-protocol-pdf-sections.ts (οι ενότητες) · handover-protocol-pdf.server.ts (συνημμένο → σφράγιση)
 *
 * ⛔ **Το αποτέλεσμα ΔΕΝ είναι Πρωτόκολλο.** Είναι το υλικό που θα σφραγιστεί. Κανείς δεν το αποθηκεύει ούτε το δίνει σε
 *    άνθρωπο: η μόνη έξοδος προς τα έξω είναι το `produceHandoverProtocolPdf`, που επιστρέφει **μόνο** σφραγισμένο PDF.
 * 🔑 **Ντετερμινιστικό**: CreationDate και `/ID` παράγονται από τον χρόνο έκδοσης και την ταυτότητα του πρωτοκόλλου
 *    (σε UTC, ανεξάρτητα από τη ζώνη του διακομιστή) · το υποσέλιδο γράφει τον χρόνο **έκδοσης**, όχι «τώρα». Ίδια όψη ⇒
 *    ίδια bytes ⇒ η άγκυρα συγκρίνει αυτολεξεί.
 * 🔑 jsPDF + Roboto `Identity-H` (ADR-267): τα ελληνικά ενσωματώνονται ως γλύφοι με χάρτη ToUnicode, άρα το κείμενο
 *    **αναζητείται** και **αντιγράφεται** από κάθε πρόγραμμα ανάγνωσης.
 */

import { jsPDF } from 'jspdf';

import { formatOperatorDateTime } from '@/lib/operator-time-format';
import { HANDOVER_DELIVERY_DIGEST_SCHEME } from '@/lib/property-handover/handover-delivery-plan';
import { registerGreekFont } from '@/services/pdf/greek-font-loader';
import { addReportPdfFooters, type PdfVerticalLayout } from '@/services/report-engine/report-pdf-chrome';

import {
  drawProtocolDigest,
  drawProtocolEvents,
  drawProtocolFiles,
  drawProtocolHeader,
  drawProtocolParties,
  drawProtocolTerms,
  drawProtocolTextReference,
  drawProtocolVerification,
  type ProtocolPage,
} from './handover-protocol-pdf-sections';
import type { HandoverProtocolView } from './handover-protocol-view';
import type { HandoverProtocolWording } from './handover-protocol-wording';

const LAYOUT: PdfVerticalLayout = { pageHeight: 297, marginTop: 16, marginBottom: 18 };

const pad = (n: number): string => String(n).padStart(2, '0');

/** ISO → ημερομηνία PDF (ISO 32000-1 §7.9.4) σε **UTC** — ποτέ η τοπική ζώνη του διακομιστή. */
export function pdfDateOf(iso: string): string {
  const t = new Date(iso);
  return `D:${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}${pad(t.getUTCSeconds())}+00'00'`;
}

/** Το `/ID` του αρχείου (32 hex) — το uuid της ταυτότητας του πρωτοκόλλου, χωρίς πρόθεμα και παύλες. */
export function pdfFileIdOf(protocolId: string): string {
  const hex = protocolId.replace(/^[a-z]+_/, '').replace(/-/g, '').toUpperCase();
  if (!/^[0-9A-F]{32}$/.test(hex)) throw new Error(`Handover protocol id has no uuid: ${protocolId}`);
  return hex;
}

function stampMetadata(pdf: jsPDF, view: HandoverProtocolView, wording: HandoverProtocolWording): void {
  pdf.setCreationDate(pdfDateOf(view.issuedAt));
  pdf.setFileId(pdfFileIdOf(view.protocolId));
  pdf.setDocumentProperties({
    title: `${view.legalText.text.title} — ${view.protocolId}`,
    subject: wording.revision(view.revision),
    author: view.issuerName,
  });
}

/** Τα δύο QR (PNG data URL) — `null` ⇒ κανένα QR, μόνο η τυπωμένη διαδρομή. */
export interface HandoverProtocolQrCodes {
  readonly legalText: string | null;
  readonly verification: string | null;
}

export const NO_HANDOVER_PROTOCOL_QR: HandoverProtocolQrCodes = { legalText: null, verification: null };

function drawBody(page: ProtocolPage, qr: HandoverProtocolQrCodes): void {
  let y = page.layout.marginTop;
  y = drawProtocolHeader(page, y);
  y = drawProtocolParties(page, y);
  y = drawProtocolEvents(page, y);
  y = drawProtocolFiles(page, y);
  y = drawProtocolDigest(page, y, HANDOVER_DELIVERY_DIGEST_SCHEME);
  y = drawProtocolTerms(page, y);
  y = drawProtocolTextReference(page, y, qr.legalText);
  drawProtocolVerification(page, y, qr.verification);
}

/** **Αποδίδει** την όψη σε PDF — ασφράγιστο υλικό, μόνο για τον παραγωγό του σφραγισμένου. */
export async function renderHandoverProtocolPdf(
  view: HandoverProtocolView,
  wording: HandoverProtocolWording,
  qr: HandoverProtocolQrCodes,
): Promise<Uint8Array> {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  await registerGreekFont(pdf);
  stampMetadata(pdf, view, wording);
  const width = pdf.internal.pageSize.getWidth();
  drawBody({ pdf, view, wording, layout: LAYOUT, width }, qr);
  addReportPdfFooters(pdf, {
    pageWidth: width,
    pageHeight: LAYOUT.pageHeight,
    centerLabel: `${view.protocolId} · ${wording.revision(view.revision)}`,
    timestampLabel: formatOperatorDateTime(view.issuedAt, 'el'),
    pageLabel: wording.page,
  });
  return new Uint8Array(pdf.output('arraybuffer'));
}
