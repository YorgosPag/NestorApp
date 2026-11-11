/**
 * @fileoverview Invoice PDF — EPC QR «Σάρωση για πληρωμή» (ADR-ACC-018 §15)
 * @description Σχεδιάζει το EPC QR (EPC069-12 v3.1) ως **διανυσματικά** τετράγωνα — καθαρά στο χαρτί σε κάθε
 *   ανάλυση, ίδια σε browser και διακομιστή (email), χωρίς PNG και χωρίς ασύγχρονο βήμα. Η γεωμετρία έρχεται από
 *   το ΕΝΑ περιτύλιγμα του `qrcode` (`qrModuleRuns`), στο επίπεδο διόρθωσης **M** που ορίζει το EPC.
 *
 * Αν το payload δεν μπορεί να υπάρξει (π.χ. όνομα > 70, > 331 bytes), **δεν** σχεδιάζεται τίποτα — ο πίνακας
 * λογαριασμών μένει η πλήρης οδηγία πληρωμής. Ποτέ κομμένο όνομα ή «διορθωμένο» ποσό μέσα σε κωδικό πληρωμής.
 *
 * Το payload το φτιάχνει ο ΕΝΑΣ ορισμός των οδηγιών πληρωμής (`services/payments/invoice-payment-instructions.ts`,
 * τον ίδιο που χρησιμοποιεί η δημόσια σελίδα πληρωμής). Εδώ γίνεται μόνο η σχεδίαση.
 *
 * @see ADR-ACC-018 §15 · §16 · services/payments/epc-qr-payload.ts
 */

import type jsPDF from 'jspdf';

import { qrModuleRuns } from '@/lib/qr/qr-code';
import { COLORS, LABELS, LAYOUT, setColor } from './invoice-pdf-constants';

/** Πλευρά του τυπωμένου QR (mm, μαζί με τη ζώνη ησυχίας) — ~0,33 mm/μονάδα στη μέγιστη έκδοση 13 του EPC. */
export const PAYMENT_QR_SIZE_MM = 26;

/** Ύψος της λεζάντας κάτω από το QR (mm). */
export const PAYMENT_QR_CAPTION_MM = 4;

/** Επικάλυψη σειρών (mm) — πολύ κάτω από τη μονάδα (~0,33 mm), αόρατη στη σάρωση. */
const ROW_OVERLAP_MM = 0.02;

/** Σχεδιάζει το QR με πάνω-αριστερή γωνία (x, y) και τη λεζάντα από κάτω· επιστρέφει το y μετά τη λεζάντα. */
export function drawPaymentQr(pdf: jsPDF, payload: string, x: number, y: number): number {
  const symbol = qrModuleRuns(payload, 'screen');
  const modules = symbol.size + symbol.quietModules * 2;
  const moduleMm = PAYMENT_QR_SIZE_MM / modules;
  const origin = symbol.quietModules * moduleMm;

  pdf.setFillColor(255, 255, 255);
  pdf.rect(x, y, PAYMENT_QR_SIZE_MM, PAYMENT_QR_SIZE_MM, 'F');
  pdf.setFillColor(0, 0, 0);
  // Μικρή επικάλυψη καθ' ύψος: διαδοχικές σειρές χωρίς λευκή «ραφή» από την εξομάλυνση του προβολέα PDF.
  for (const [row, column, length] of symbol.runs) {
    pdf.rect(x + origin + column * moduleMm, y + origin + row * moduleMm, length * moduleMm, moduleMm + ROW_OVERLAP_MM, 'F');
  }

  setColor(pdf, COLORS.grayLight);
  pdf.setFontSize(6);
  pdf.text(LABELS.scanToPay, x + PAYMENT_QR_SIZE_MM / 2, y + PAYMENT_QR_SIZE_MM + 3, { align: 'center' });
  return y + PAYMENT_QR_SIZE_MM + PAYMENT_QR_CAPTION_MM;
}

/** Η θέση x του QR: στο δεξί περιθώριο της σελίδας. */
export function paymentQrX(): number {
  return LAYOUT.pageWidth - LAYOUT.marginRight - PAYMENT_QR_SIZE_MM;
}
