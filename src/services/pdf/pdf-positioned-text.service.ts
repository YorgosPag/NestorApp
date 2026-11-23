import 'server-only';

/**
 * @fileoverview **Το κείμενο του PDF ΜΕ ΘΕΣΕΙΣ, στον server** (ADR-920 §14.11 Ζ3) — ό,τι βλέπει ο `read-pdf-on-device` στη συσκευή.
 * @related lib/pdf/pdf-page-text (`positionedPageOf`, η ΜΙΑ μετατροπή) · ./pdf-rasterize.service (`mapPdfPages`, ο ΕΝΑΣ
 *   βρόχος σελίδων) · lib/terrain/plot-outline/pdf-coordinate-table (ο αναγνώστης που το καταναλώνει)
 * @module services/pdf/pdf-positioned-text.service
 *
 * 🔑 **Γιατί υπάρχει**: η πόρτα εδάφους δεν εμπιστεύεται τον δακτύλιο που διάβασε ο browser. Ξαναδιαβάζει τον πίνακα
 * συντεταγμένων του τοπογραφικού από τα **ίδια** bytes, με τον **ίδιο** καθαρό αναγνώστη (`readPdfPlotOutline`) πάνω στο
 * **ίδιο** μοντέλο σελίδας. Χωριστό αρχείο επειδή το `pdf-rasterize.service` είναι στο όριο των 500 γραμμών (N.7.1).
 * ⚠️ Τα όρια bytes **δεν** κρίνονται εδώ: τα κρίνει ο καλών **πριν** φτάσει το PDF στον αναλυτή.
 */

import { positionedPageOf, type PdfPositionedPage } from '@/lib/pdf/pdf-page-text';

import { DEFAULT_MAX_PAGES, mapPdfPages } from './pdf-rasterize.service';

/** Οι σελίδες του PDF με τα κομμάτια κειμένου τους σε συντεταγμένες οθόνης, έως `maxPages`. Πετά αν το PDF δεν ανοίγει. */
export function readPdfPositionedPages(
  pdfBuffer: Uint8Array,
  options: { readonly maxPages?: number } = {},
): Promise<PdfPositionedPage[]> {
  return mapPdfPages(pdfBuffer, options.maxPages ?? DEFAULT_MAX_PAGES, async (page, pageNum) =>
    positionedPageOf(pageNum, page.getViewport({ scale: 1 }), (await page.getTextContent()).items),
  );
}
