/**
 * @fileoverview **ΟΙ ΕΝΟΤΗΤΕΣ ΤΟΥ PDF ΠΛΗΡΟΦΟΡΙΑΚΟΥ ΥΠΟΛΟΓΙΣΜΟΥ** — κεφαλίδα · ακίνητο · αποτέλεσμα · πίνακες · ζεύγη · χαρακτήρας ·
 *               επαλήθευση (ADR-947 Φ2β).
 * @module services/pdf/renderers/objective-value/objective-value-pdf-sections
 * @related services/pdf/pdf-flow.ts (τα δομικά στοιχεία — κοινά με το Πρωτόκολλο παράδοσης) · objective-value-pdf-view.ts
 *
 * 🔑 Κάθε ενότητα παίρνει το `y` όπου ξεκινά και επιστρέφει το `y` όπου τελείωσε. **Καμία λέξη εδώ**: μόνο ό,τι έφερε η όψη.
 */

import { drawPdfAppBrand, type PdfAppLogo } from '@/services/pdf/pdf-app-logo';
import {
  drawFlowHeading,
  drawFlowPairs,
  drawFlowParagraph,
  drawFlowQrPairs,
  drawFlowTable,
  type PdfFlowColumnStyles,
  type PdfFlowPage,
} from '@/services/pdf/pdf-flow';
import { MARGIN, SLATE_500, SLATE_800, ensurePageSpace } from '@/services/report-engine/report-pdf-chrome';

import type { ObjectiveValuePdfPairsSection, ObjectiveValuePdfTable, ObjectiveValuePdfView } from './objective-value-pdf-view';

/** Μέγεθος κειμένου των πινάκων ανάγνωσης — ο ιδιοκτήτης τους διαβάζει, δεν είναι αποτυπώματα. */
const TABLE_FONT_SIZE = 8;

/** Πλάτη στηλών σε mm (A4 · περιθώριο 14 ⇒ 182 ωφέλιμα). */
export const FACTOR_COLUMNS: PdfFlowColumnStyles = { 0: { cellWidth: 62 }, 1: { cellWidth: 22, halign: 'right' }, 2: { cellWidth: 98 } };
export const INPUT_COLUMNS: PdfFlowColumnStyles = { 0: { cellWidth: 62 }, 1: { cellWidth: 52 }, 2: { cellWidth: 68 } };

/** Το λογότυπο της κεφαλίδας: πλευρά (mm). */
const HEADER_LOGO_SIZE = 12;

/**
 * **Η κεφαλίδα**: σφραγίδα «λογότυπο + Nestor App» πάνω αριστερά, σύνδεσμος στην εφαρμογή (όπως το υποσέλιδο των
 * email) · ο τίτλος από κάτω · χαρακτήρας του αντιγράφου (συσκευή ή στιγμιότυπο) · βασικά στοιχεία.
 */
export function drawObjectiveValueHeader(page: PdfFlowPage, view: ObjectiveValuePdfView, y: number, logo: PdfAppLogo | null): number {
  const { pdf } = page;
  const afterBrand = drawPdfAppBrand(pdf, logo, view.brand, { x: MARGIN, y, size: HEADER_LOGO_SIZE });
  pdf.setFont('Roboto', 'bold');
  pdf.setFontSize(15);
  pdf.setTextColor(...SLATE_800);
  pdf.text(view.title, MARGIN, afterBrand + 9);
  const afterNotice = drawFlowParagraph(page, view.notice, afterBrand + 13, 8);
  return drawFlowPairs(page, view.facts, afterNotice + 1);
}

/** **Το ακίνητο** — περιγραφή · διεύθυνση · ΚΑΕΚ · χαρακτηριστικά (RICS: «identification»). `null` ⇒ τίποτα. */
export function drawObjectiveValueSubject(page: PdfFlowPage, view: ObjectiveValuePdfView, y: number): number {
  return view.subject === null ? y : drawObjectiveValuePairs(page, view.subject, y);
}

/** **Το αποτέλεσμα**: η ετικέτα «αντικειμενική (ενδεικτική)» μικρή, το ποσό μεγάλο, η βάση από κάτω. */
export function drawObjectiveValueResult(page: PdfFlowPage, view: ObjectiveValuePdfView, y: number): number {
  const { pdf } = page;
  const top = drawFlowHeading(page, view.result.heading, y);
  const block = ensurePageSpace(pdf, top, 16, page.layout);
  const [label, amount] = view.result.value;
  pdf.setFont('Roboto', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(...SLATE_500);
  pdf.text(label, MARGIN, block + 3);
  pdf.setFont('Roboto', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(...SLATE_800);
  pdf.text(amount, MARGIN, block + 11);
  return drawFlowParagraph(page, view.result.base, block + 15);
}

/** Πίνακας τριών στηλών με επικεφαλίδα — συντελεστές ή είσοδοι. Χωρίς γραμμές ⇒ τίποτα. */
export function drawObjectiveValueTable(page: PdfFlowPage, table: ObjectiveValuePdfTable, y: number, columns: PdfFlowColumnStyles): number {
  if (table.rows.length === 0) return y;
  const top = drawFlowHeading(page, table.heading, y);
  return drawFlowTable(page, top, table.columns, table.rows, columns, TABLE_FONT_SIZE) + 4;
}

/** Ζεύγη «ετικέτα · τιμή» με επικεφαλίδα — ζώνη, μηχανή. */
export function drawObjectiveValuePairs(page: PdfFlowPage, section: ObjectiveValuePdfPairsSection, y: number): number {
  const top = drawFlowHeading(page, section.heading, y);
  return drawFlowPairs(page, section.rows, top);
}

/** **Ο χαρακτήρας του εγγράφου** — πληροφοριακός υπολογισμός, και πού οριστικοποιείται η φορολογητέα αξία. */
export function drawObjectiveValueStatement(page: PdfFlowPage, view: ObjectiveValuePdfView, y: number): number {
  const top = drawFlowHeading(page, view.statement.heading, y);
  const afterText = view.statement.paragraphs.reduce((cursor, text) => drawFlowParagraph(page, text, cursor), top);
  return drawFlowPairs(page, [view.statement.link], afterText);
}

/** **Η επαλήθευση** (μόνο στιγμιότυπο): κωδικός · αποτύπωμα · σύνδεσμος, QR δεξιά, και οι οδηγίες για τον τρίτο. */
export function drawObjectiveValueVerification(page: PdfFlowPage, view: ObjectiveValuePdfView, y: number, qrPng: string | null): number {
  const { verification } = view;
  if (verification === null) return y;
  const top = drawFlowHeading(page, verification.heading, y);
  const afterRows = drawFlowQrPairs(page, top, verification.rows, qrPng);
  return verification.notes.reduce((cursor, note) => drawFlowParagraph(page, note, cursor, 7.5), afterRows);
}
