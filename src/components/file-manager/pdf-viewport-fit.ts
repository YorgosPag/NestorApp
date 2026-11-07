/**
 * **Η προσαρμογή της σελίδας PDF στον χώρο** (ADR-928 §5.25.2) — καθαρό, μηδέν DOM.
 *
 * 🏆 Chrome PDF · pdf.js · Acrobat: δύο τρόποι προσαρμογής — **πλάτος** (η σελίδα γεμίζει το πλάτος, κάθετη κύλιση από την
 *    κορυφή) και **σελίδα** (ολόκληρη η σελίδα ορατή). Όσο ισχύει ένας τρόπος, το ζουμ **ακολουθεί** τον χώρο (αλλαγή
 *    πλάτους πάνελ, στροφή, άλλη σελίδα)· η πρώτη χειροκίνητη αλλαγή τον σβήνει.
 * 🔑 Ταβάνι ×2 (το ίδιο με τη σελίδα εγγράφου, `PAPER_MAX_ZOOM`): μια μικρή απόδειξη δεν γίνεται 500 % επειδή το πάνελ
 *    είναι φαρδύ — πάνω από αυτό δεν διαβάζεις καλύτερα, απλώς κυλάς περισσότερο.
 * 🔑 Στρογγύλευση **προς τα κάτω** σε χιλιοστά: μισό pixel πάνω από τον χώρο θα γεννούσε γραμμή κύλισης που δεν χρειάζεται.
 */

import { clampZoom, type Extent, type ZoomLimits } from '@/lib/geometry/zoom-pan-math';

export type PdfFitMode = 'width' | 'page';

/** Το ταβάνι της προσαρμογής — όχι του χειροκίνητου ζουμ (εκεί ισχύουν τα όρια του θεατή). */
export const PDF_FIT_MAX_SCALE = 2;

/** Ο **άλλος** τρόπος — η εναλλαγή του Chrome PDF (ένα κουμπί / συντόμευση γυρίζει πλάτος ⇄ σελίδα). */
export function otherFitMode(mode: PdfFitMode | null): PdfFitMode {
  return mode === 'width' ? 'page' : 'width';
}

/**
 * Το ζουμ που κάνει μια σελίδα `page` (σε κλίμακα 1, **ήδη** στραμμένη) να χωρά στον χώρο `box` (χωρίς περιθώρια) κατά
 * τον τρόπο `mode`, μέσα στα όρια του θεατή και κάτω από το ταβάνι της προσαρμογής.
 */
export function pdfFitScaleOf(mode: PdfFitMode, page: Extent, box: Extent, limits: ZoomLimits): number {
  if (page.width <= 0 || page.height <= 0 || box.width <= 0) return clampZoom(1, limits);
  const byWidth = box.width / page.width;
  const raw = mode === 'width' || box.height <= 0 ? byWidth : Math.min(byWidth, box.height / page.height);
  return Math.floor(clampZoom(Math.min(raw, PDF_FIT_MAX_SCALE), limits) * 1000) / 1000;
}
