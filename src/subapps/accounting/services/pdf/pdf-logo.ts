/**
 * @fileoverview **Η ΜΙΑ ενσωμάτωση λογοτύπου** στα PDF της λογιστικής (τιμολόγιο · βεβαίωση ΑΠΥ).
 * @description Το jsPDF αποκωδικοποιεί το PNG σε ωμά pixels και, **χωρίς** ρητή συμπίεση, τα γράφει ασυμπίεστα:
 *   ΜΕΤΡΗΜΕΝΟ 2026-11-11 στο τιμολόγιο Α-7 — λογότυπο 1024×1024 (PNG 47 KB) ⇒ 3 MB χρώμα + 1 MB διαφάνεια, δηλαδή
 *   4,0 από τα 4,4 MB του PDF (και 6,1 MB το email). Με Flate (`'FAST'`) η εικόνα συμπιέζεται όπως και στο PNG.
 *   Το alias κάνει τη δεύτερη χρήση στο ίδιο έγγραφο αναφορά στο ίδιο αντικείμενο, όχι δεύτερο αντίγραφο.
 */

import type jsPDF from 'jspdf';

/** Τετράγωνο κουτί του λογοτύπου στη σελίδα (μονάδες του εγγράφου). */
export interface PdfLogoBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const LOGO_IMAGE_ALIAS = 'accounting-logo';

/** Βάζει το λογότυπο (base64 PNG) συμπιεσμένο. */
export function drawPdfLogo(pdf: jsPDF, logoBase64: string, box: PdfLogoBox): void {
  pdf.addImage(`data:image/png;base64,${logoBase64}`, 'PNG', box.x, box.y, box.width, box.height, LOGO_IMAGE_ALIAS, 'FAST');
}
