/**
 * @fileoverview **ΤΟ ΛΟΓΟΤΥΠΟ ΤΗΣ ΕΦΑΡΜΟΓΗΣ ΣΤΑ PDF** — τύπος · σχεδίαση · σφραγίδα «λογότυπο + όνομα» ως σύνδεσμος ·
 *               φόρτωση στη συσκευή (ADR-947 Φ2β).
 * @module services/pdf/pdf-app-logo
 * @related config/email-assets.ts (`NESTOR_APP_LOGO` — το ΙΔΙΟ αρχείο που δείχνουν τα email) ·
 *   services/pdf/pdf-app-logo.server.ts (ανάγνωση στον server)
 *
 * 🔑 **Ένα αρχείο, μία δήλωση**: η διαδρομή και ο τύπος έρχονται από το `NESTOR_APP_LOGO`, που η άγκυρά του κρατά
 *    αμετάβλητο (bytes · διαστάσεις). Κανένα δεύτερο λεκτικό `/images/...` εδώ.
 * 🔑 **JPEG ⇒ αυτούσιο**: το jsPDF γράφει το JPEG ως έχει (DCT), δηλαδή ~14 KB στο PDF — όχι ωμά pixels.
 * 🔑 **Λογότυπο που λείπει ≠ PDF που αποτυγχάνει**: `null` ⇒ κεφαλίδα μόνο με κείμενο.
 * ⚠️ **Είναι το σήμα του ΠΡΟΪΟΝΤΟΣ**, όχι του ενοίκου — το λογότυπο εταιρείας είναι άλλη υπόθεση (ADR-928 §5.11).
 */

import type jsPDF from 'jspdf';

import { NESTOR_APP_LOGO } from '@/config/email-assets';
import { PRODUCT_NAME } from '@/constants/product-identity';
import { SLATE_800 } from '@/services/report-engine/report-pdf-chrome';

/** Τα bytes του λογοτύπου, έτοιμα για το `addImage`. */
export interface PdfAppLogo {
  readonly bytes: Uint8Array;
  readonly format: 'JPEG' | 'PNG';
}

/** Τετράγωνο κουτί του λογοτύπου στη σελίδα (μονάδες του εγγράφου). */
export interface PdfAppLogoBox {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

/** Ο τύπος του jsPDF, από τον δηλωμένο τύπο του αρχείου. */
export const PDF_APP_LOGO_FORMAT: PdfAppLogo['format'] = NESTOR_APP_LOGO.mediaType === 'image/jpeg' ? 'JPEG' : 'PNG';

/** Η διαδρομή του αρχείου όπως τη ζητά ο browser (και, κάτω από το `public/`, ο server). */
export const PDF_APP_LOGO_PUBLIC_PATH = NESTOR_APP_LOGO.publicPath;

const PDF_APP_LOGO_ALIAS = 'nestor-app-logo';

/** Βάζει το λογότυπο στο κουτί — η δεύτερη χρήση στο ίδιο έγγραφο είναι αναφορά στο ίδιο αντικείμενο (alias). */
export function drawPdfAppLogo(pdf: jsPDF, logo: PdfAppLogo, box: PdfAppLogoBox): void {
  pdf.addImage(logo.bytes, logo.format, box.x, box.y, box.size, box.size, PDF_APP_LOGO_ALIAS, 'FAST');
}

/**
 * **Η σφραγίδα του προϊόντος**: όνομα + πού οδηγεί. Ίδια με το υποσέλιδο των email (λογότυπο + «Nestor App»).
 * `href === null` ⇒ καμία περιοχή συνδέσμου — ποτέ σχετικός ή μαντεμένος σύνδεσμος (`lib/http/public-origin`).
 */
export interface PdfAppBrand {
  readonly name: string;
  readonly href: string | null;
}

export function pdfAppBrand(href: string | null): PdfAppBrand {
  return { name: PRODUCT_NAME, href };
}

/** Μέγεθος (pt) και κενό (mm) του ονόματος δίπλα στο λογότυπο. */
const BRAND_NAME_FONT_SIZE = 13;
const BRAND_NAME_GAP = 3;

/**
 * **Λογότυπο + όνομα, όλο σύνδεσμος** (ADR-947 §11 Δ-Φ2β.1). Χωρίς λογότυπο ⇒ μόνο το όνομα, πάλι σύνδεσμος.
 * Επιστρέφει το `y` κάτω από τη σφραγίδα. Προϋπόθεση: η γραμματοσειρά Roboto έχει ήδη καταχωριστεί.
 */
export function drawPdfAppBrand(pdf: jsPDF, logo: PdfAppLogo | null, brand: PdfAppBrand, box: PdfAppLogoBox): number {
  if (logo !== null) drawPdfAppLogo(pdf, logo, box);
  const textLeft = logo === null ? box.x : box.x + box.size + BRAND_NAME_GAP;
  const height = logo === null ? 7 : box.size;
  pdf.setFont('Roboto', 'bold');
  pdf.setFontSize(BRAND_NAME_FONT_SIZE);
  pdf.setTextColor(...SLATE_800);
  // Η γραμμή βάσης ώστε τα κεφαλαία να κάθονται στο κέντρο του λογοτύπου (ύψος κεφαλαίων ≈ 0,7 × μέγεθος).
  pdf.text(brand.name, textLeft, box.y + height / 2 + (BRAND_NAME_FONT_SIZE * 0.3528 * 0.7) / 2);
  if (brand.href !== null) {
    const width = textLeft + pdf.getTextWidth(brand.name) - box.x;
    pdf.link(box.x, box.y, width, height, { url: brand.href });
  }
  return box.y + height;
}

/** **Στη συσκευή**: το ίδιο στατικό αρχείο της εφαρμογής (όχι API). Αποτυχία ⇒ `null`, ποτέ αποτυχία λήψης του PDF. */
export async function fetchPdfAppLogo(): Promise<PdfAppLogo | null> {
  try {
    const response = await fetch(PDF_APP_LOGO_PUBLIC_PATH);
    if (!response.ok) return null;
    return { bytes: new Uint8Array(await response.arrayBuffer()), format: PDF_APP_LOGO_FORMAT };
  } catch {
    return null;
  }
}
