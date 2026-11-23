/**
 * @fileoverview **Η ΡΟΗ ΕΝΟΣ ΕΓΓΡΑΦΟΥ ΑΠΟΔΕΙΞΗΣ** — επικεφαλίδα · παράγραφος · ζεύγη «ετικέτα · τιμή» · πίνακας · αναφορά με
 *               QR, πάνω σε jsPDF, με αλλαγή σελίδας που δεν γράφει ποτέ κάτω από το υποσέλιδο (ADR-916 Φ-Γ2 Σ4 ·
 *               ADR-947 Φ2β).
 * @module services/pdf/pdf-flow
 * @related services/report-engine/report-pdf-chrome.ts (παλέτα · περιθώριο · υποσέλιδο) ·
 *   renderers/handover-protocol/handover-protocol-pdf-sections.ts · renderers/objective-value/objective-value-pdf-sections.ts
 *
 * 🔑 Κάθε στοιχείο παίρνει το `y` όπου ξεκινά και επιστρέφει το `y` όπου τελείωσε — καμία κοινή μεταβλητή κατάστασης.
 * 🔑 **Γιατί κοινό**: ζούσε ιδιωτικό μέσα στις ενότητες του Πρωτοκόλλου παράδοσης. Το PDF πληροφοριακού υπολογισμού
 *    χρειάστηκε **ακριβώς** τα ίδια· ένα δεύτερο αντίγραφο θα ήταν το δίδυμο που πιάνει το CHECK 3.28 — και δύο έγγραφα
 *    του ίδιου προϊόντος που αποκλίνουν σιωπηλά στη μορφή τους (N.0.2).
 * 🔑 **Τα αναγνωριστικά και τα αποτυπώματα σπάνε σε σταθερά σημεία** ({@link chunkText}), ποτέ όπου τύχει.
 */

import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import {
  MARGIN,
  PRIMARY,
  SLATE_200,
  SLATE_500,
  SLATE_800,
  ensurePageSpace,
  forceRobotoCell,
  yAfterTable,
  type PdfVerticalLayout,
} from '@/services/report-engine/report-pdf-chrome';

/** Η σελίδα πάνω στην οποία ρέει το έγγραφο. */
export interface PdfFlowPage {
  readonly pdf: jsPDF;
  readonly layout: PdfVerticalLayout;
  readonly width: number;
}

/** Ζεύγος «ετικέτα · τιμή». */
export type PdfFlowPair = readonly [label: string, value: string];

export type PdfFlowColumnStyles = NonNullable<Parameters<typeof autoTable>[1]['columnStyles']>;

const LINE = 4.2;
const SMALL_LINE = 3.6;
const QR_SIZE = 26;

/** Σπάει σε κομμάτια των `size` χαρακτήρων — σταθερά, για αναγνωριστικά και hex. */
export const chunkText = (text: string, size: number): string => (text.match(new RegExp(`.{1,${size}}`, 'gu')) ?? [text]).join('\n');

/** Επικεφαλίδα ενότητας με λεπτή γραμμή από κάτω· μεταφέρεται ολόκληρη σε νέα σελίδα αν δεν χωρά. */
export function drawFlowHeading(page: PdfFlowPage, text: string, y: number): number {
  const top = ensurePageSpace(page.pdf, y, 12, page.layout);
  page.pdf.setFont('Roboto', 'bold');
  page.pdf.setFontSize(10.5);
  page.pdf.setTextColor(...SLATE_800);
  page.pdf.text(text, MARGIN, top + 5);
  page.pdf.setDrawColor(...SLATE_200);
  page.pdf.setLineWidth(0.2);
  page.pdf.line(MARGIN, top + 6.5, page.width - MARGIN, top + 6.5);
  return top + 10;
}

/** Παράγραφος με αναδίπλωση και αλλαγή σελίδας ανά γραμμή — ποτέ κείμενο κάτω από το υποσέλιδο. */
export function drawFlowParagraph(page: PdfFlowPage, text: string, y: number, size = 8.5, indent = 0): number {
  page.pdf.setFont('Roboto', 'normal');
  page.pdf.setFontSize(size);
  page.pdf.setTextColor(...SLATE_800);
  const lines: string[] = page.pdf.splitTextToSize(text, page.width - 2 * MARGIN - indent);
  let cursor = y;
  for (const line of lines) {
    cursor = ensurePageSpace(page.pdf, cursor, LINE, page.layout);
    page.pdf.text(line, MARGIN + indent, cursor + 3);
    cursor += size >= 8.5 ? LINE : SMALL_LINE;
  }
  return cursor + 1.5;
}

/** Ζεύγη «ετικέτα · τιμή» σε πίνακα δύο στηλών· `rightInset` αφήνει χώρο δεξιά (π.χ. για QR). */
export function drawFlowPairs(page: PdfFlowPage, rows: readonly PdfFlowPair[], y: number, rightInset = 0): number {
  autoTable(page.pdf, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN + rightInset, top: page.layout.marginTop, bottom: page.layout.marginBottom },
    theme: 'plain',
    body: rows.map(([label, value]) => [label, value]),
    styles: { font: 'Roboto', fontSize: 8.5, cellPadding: 1, textColor: SLATE_800 },
    columnStyles: { 0: { cellWidth: 58, textColor: SLATE_500 } },
    didParseCell: forceRobotoCell,
  });
  return yAfterTable(page.pdf, y, rows.length * LINE) + 3;
}

/** Πίνακας με κεφαλίδα στο χρώμα της μηχανής αναφορών — ίδια γραμματοσειρά, χρώματα, περιθώρια σε κάθε έγγραφο. */
export function drawFlowTable(
  page: PdfFlowPage,
  top: number,
  head: readonly string[],
  body: readonly (readonly string[])[],
  columnStyles: PdfFlowColumnStyles,
  /** Μέγεθος κειμένου σώματος — 6,5 για πίνακες με αποτυπώματα (Πρωτόκολλο), μεγαλύτερο για πίνακες ανάγνωσης. */
  fontSize = 6.5,
): number {
  autoTable(page.pdf, {
    startY: top,
    margin: { left: MARGIN, right: MARGIN, top: page.layout.marginTop, bottom: page.layout.marginBottom },
    head: [[...head]],
    body: body.map((row) => [...row]),
    styles: { font: 'Roboto', fontSize, cellPadding: 1.2, textColor: SLATE_800, valign: 'top' },
    headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontSize: fontSize + 0.5 },
    columnStyles,
    didParseCell: forceRobotoCell,
  });
  return yAfterTable(page.pdf, top, 10);
}

/** Ζεύγη με ετικέτα και, δεξιά, QR — μόνο όταν υπάρχει εικόνα κωδικού (το ΕΝΑ σχήμα «σύνδεσμος + QR»). */
export function drawFlowQrPairs(page: PdfFlowPage, y: number, rows: readonly PdfFlowPair[], qrPng: string | null): number {
  const top = ensurePageSpace(page.pdf, y, QR_SIZE + 6, page.layout);
  if (qrPng !== null) page.pdf.addImage(qrPng, 'PNG', page.width - MARGIN - QR_SIZE, top, QR_SIZE, QR_SIZE);
  const after = drawFlowPairs(page, rows, top, qrPng === null ? 0 : QR_SIZE + 3);
  return Math.max(after, qrPng === null ? after : top + QR_SIZE + 3);
}
