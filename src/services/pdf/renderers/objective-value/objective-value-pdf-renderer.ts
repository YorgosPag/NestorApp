/**
 * @fileoverview **Ο ΕΝΑΣ RENDERER ΤΟΥ PDF ΠΛΗΡΟΦΟΡΙΑΚΟΥ ΥΠΟΛΟΓΙΣΜΟΥ** — όψη → bytes PDF (ADR-947 Φ2β · Δ-Φ2.2).
 * @module services/pdf/renderers/objective-value/objective-value-pdf-renderer
 * @related objective-value-pdf-view.ts (η όψη) · objective-value-pdf.server.ts (στιγμιότυπο: QR + συνημμένο) ·
 *   components/objective-value/ObjectiveValuePdfButton.tsx (συσκευή: βαθμίδα 1)
 *
 * 🔑 **Ένας renderer, δύο τόποι**: τρέχει στη συσκευή (βαθμίδα 1 — κανένα byte δεν φεύγει, τίποτα δεν αποθηκεύεται) **και**
 *    στον server (στιγμιότυπο). Ισομορφικό: jsPDF + Roboto `Identity-H` (ADR-267) — τα ελληνικά αναζητούνται και
 *    αντιγράφονται από κάθε πρόγραμμα ανάγνωσης.
 * 🔑 **Ντετερμινιστικό όταν υπάρχει ταυτότητα**: CreationDate και `/ID` από το `id` και το `createdAt` του στιγμιοτύπου
 *    (`pdf-deterministic-identity`), και το υποσέλιδο γράφει τον χρόνο **σύνταξης**, όχι «τώρα» ⇒ ίδιο στιγμιότυπο, ίδια bytes.
 */

import { jsPDF } from 'jspdf';

import { registerGreekFont } from '@/services/pdf/greek-font-loader';
import type { PdfAppLogo } from '@/services/pdf/pdf-app-logo';
import { pdfDateOf, pdfFileIdOf } from '@/services/pdf/pdf-deterministic-identity';
import type { PdfFlowPage } from '@/services/pdf/pdf-flow';
import { addReportPdfFooters, type PdfVerticalLayout } from '@/services/report-engine/report-pdf-chrome';

import {
  FACTOR_COLUMNS,
  INPUT_COLUMNS,
  drawObjectiveValueHeader,
  drawObjectiveValuePairs,
  drawObjectiveValueResult,
  drawObjectiveValueStatement,
  drawObjectiveValueSubject,
  drawObjectiveValueTable,
  drawObjectiveValueVerification,
} from './objective-value-pdf-sections';
import type { ObjectiveValuePdfView } from './objective-value-pdf-view';

const LAYOUT: PdfVerticalLayout = { pageHeight: 297, marginTop: 16, marginBottom: 18 };

/**
 * Οι εικόνες του PDF — **υποχρεωτικές** και οι δύο, ώστε κανείς καλών να μην ξεχάσει σιωπηλά το λογότυπο.
 * `qrPng` = QR επαλήθευσης (μόνο στιγμιότυπο)· `logo` = λογότυπο της εφαρμογής (`fetchPdfAppLogo` στη συσκευή,
 * `readPdfAppLogo` στον server). `null` ⇒ η εικόνα παραλείπεται.
 */
export interface ObjectiveValuePdfImages {
  readonly qrPng: string | null;
  readonly logo: PdfAppLogo | null;
}

function stampMetadata(pdf: jsPDF, view: ObjectiveValuePdfView): void {
  if (view.identity !== null) {
    pdf.setCreationDate(pdfDateOf(view.identity.issuedAt));
    pdf.setFileId(pdfFileIdOf(view.identity.id));
  }
  pdf.setDocumentProperties({ ...view.properties });
  pdf.setLanguage(view.language);
}

/** Η σειρά των ενοτήτων — η ΙΔΙΑ για συσκευή και στιγμιότυπο· η επαλήθευση εμφανίζεται μόνο όπου υπάρχει. */
function drawBody(page: PdfFlowPage, view: ObjectiveValuePdfView, images: ObjectiveValuePdfImages): void {
  let y = page.layout.marginTop;
  y = drawObjectiveValueHeader(page, view, y, images.logo);
  y = drawObjectiveValueSubject(page, view, y);
  y = drawObjectiveValueResult(page, view, y);
  y = drawObjectiveValueTable(page, view.factors, y, FACTOR_COLUMNS);
  y = drawObjectiveValueTable(page, view.inputs, y, INPUT_COLUMNS);
  y = drawObjectiveValuePairs(page, view.zone, y);
  y = drawObjectiveValuePairs(page, view.engine, y);
  y = drawObjectiveValueStatement(page, view, y);
  drawObjectiveValueVerification(page, view, y, images.qrPng);
}

/** **Αποδίδει** την όψη σε PDF, με τις εικόνες του {@link ObjectiveValuePdfImages}. */
export async function renderObjectiveValuePdf(view: ObjectiveValuePdfView, images: ObjectiveValuePdfImages): Promise<Uint8Array> {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  await registerGreekFont(pdf);
  stampMetadata(pdf, view);
  const width = pdf.internal.pageSize.getWidth();
  drawBody({ pdf, layout: LAYOUT, width }, view, images);
  addReportPdfFooters(pdf, {
    pageWidth: width,
    pageHeight: LAYOUT.pageHeight,
    centerLabel: view.footer.center,
    timestampLabel: view.footer.timestamp,
    pageLabel: view.footer.pageLabel,
  });
  return new Uint8Array(pdf.output('arraybuffer'));
}
