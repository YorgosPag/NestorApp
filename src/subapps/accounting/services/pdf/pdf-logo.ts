/**
 * @fileoverview **Η ΜΙΑ ενσωμάτωση λογοτύπου** στα PDF της λογιστικής (τιμολόγιο · βεβαίωση ΑΠΥ).
 * @description Το jsPDF αποκωδικοποιεί το PNG σε ωμά pixels και, **χωρίς** ρητή συμπίεση, τα γράφει ασυμπίεστα:
 *   ΜΕΤΡΗΜΕΝΟ 2026-11-11 στο τιμολόγιο Α-7 — λογότυπο 1024×1024 (PNG 47 KB) ⇒ 3 MB χρώμα + 1 MB διαφάνεια, δηλαδή
 *   4,0 από τα 4,4 MB του PDF (και 6,1 MB το email). Με Flate (`'FAST'`) η εικόνα συμπιέζεται όπως και στο PNG· το
 *   JPEG γράφεται αυτούσιο (DCT). Το alias κάνει τη δεύτερη χρήση στο ίδιο έγγραφο αναφορά στο ίδιο αντικείμενο.
 *
 *   🔑 **Λογότυπο του χώρου (ADR-ACC-018 §17.3)**: μορφή από το asset (PNG/JPEG) και **aspect-fit** μέσα στο κουτί —
 *   τα λογότυπα σπάνια είναι τετράγωνα, και ως τη Φ1β ζωγραφίζονταν 25×25 mm παραμορφωμένα. Με website ⇒ όλο το
 *   λογότυπο είναι σύνδεσμος (μοτίβο `drawPdfAppBrand`, ADR-947 §11)· χωρίς ⇒ καμία περιοχή συνδέσμου.
 */

import type jsPDF from 'jspdf';

import type { PdfBrandImage } from '@/lib/company/brand-logo-image';

/** Κουτί στη σελίδα (μονάδες του εγγράφου). */
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

/**
 * **Aspect-fit**: το μεγαλύτερο κουτί με την αναλογία της εικόνας που χωράει στο `box`, κολλημένο πάνω-αριστερά (εκεί
 * ξεκινά και το κείμενο του εκδότη). Μη θετικές διαστάσεις ⇒ ολόκληρο το κουτί (ποτέ `NaN` στη σελίδα).
 */
export function fitPdfLogoBox(image: Pick<PdfBrandImage, 'width' | 'height'>, box: PdfLogoBox): PdfLogoBox {
  if (!(image.width > 0 && image.height > 0)) return box;
  const scale = Math.min(box.width / image.width, box.height / image.height);
  return { x: box.x, y: box.y, width: image.width * scale, height: image.height * scale };
}

/**
 * Το λογότυπο του χώρου μέσα στο `box`, στη δική του αναλογία· `href !== null` ⇒ σύνδεσμος πάνω στο λογότυπο.
 * Επιστρέφει το κουτί που **πράγματι** ζωγραφίστηκε — ο καλών μετρά από εκεί το επόμενο στοιχείο.
 */
export function drawPdfBrandLogo(pdf: jsPDF, image: PdfBrandImage, box: PdfLogoBox, href: string | null): PdfLogoBox {
  const drawn = fitPdfLogoBox(image, box);
  pdf.addImage(image.bytes, image.format, drawn.x, drawn.y, drawn.width, drawn.height, `brand-logo-${image.sha256}`, 'FAST');
  if (href !== null) pdf.link(drawn.x, drawn.y, drawn.width, drawn.height, { url: href });
  return drawn;
}
