/**
 * **Το έγγραφο ως σελίδα, με ζουμ** (ADR-928 §5.23 · §5.25) — όπως το Word, το Google Docs, το Acrobat και κάθε προβολέας
 * PDF: η σελίδα κρατά πλάτος Α4 και **μεγεθύνεται**, δεν απλώνει το κείμενο.
 *
 * 🔑 Φαρδύτερη στήλη **δεν** σημαίνει μακρύτερες γραμμές: πάνω από ~90 χαρακτήρες το μάτι χάνει τη γραμμή, και το
 *    τυπωμένο έγγραφο έχει πλάτος Α4. Άρα μεγέθυνση με CSS `zoom` (αλλάζει και τη διάταξη — όχι `transform`, που αφήνει
 *    λάθος ύψος και κύλιση· πρότυπο σε Chrome/Edge/Safari και Firefox ≥ 126).
 * 🔑 Δύο τρόποι (§5.25): **«Προσαρμογή στο πλάτος»** (προεπιλογή — ξαναϋπολογίζεται σε κάθε πλάτος) και **χειροκίνητο**
 *    50–200 %. Σε «Προσαρμογή», στήλη στενότερη από Α4 ⇒ καμία σμίκρυνση: το κείμενο ρέει (κινητό — ζουμ < 1 =
 *    δυσανάγνωστα γράμματα). Το χειροκίνητο κρατά πάντα σελίδα Α4: ό,τι ζήτησες, αυτό βλέπεις.
 * 🔑 Ταβάνι ×2, το ίδιο με τον προβολέα PDF: πάνω από αυτό δεν διαβάζεις καλύτερα.
 * 🔑 Καθαρό αρχείο — η εφαρμογή στο DOM (`applyPaperLayout`) γίνεται **προστακτικά** από τη μηχανή
 *    (`document-zoom-engine.ts`), όχι ως `style` στο JSX: αλλάζει σε κάθε pixel συρσίματος (ADR-040).
 */

import { clampZoom, type ZoomLimits } from '@/lib/geometry/zoom-pan-math';

/** Πλάτος Α4 (210 mm) σε CSS px, στα 96 dpi του CSS. */
export const PAPER_A4_WIDTH_PX = 794;
export const PAPER_MAX_ZOOM = 2;
/** Τα όρια του χειροκίνητου ζουμ σελίδας (Google Docs: 50–200 %). */
export const PAPER_ZOOM_LIMITS: ZoomLimits = { min: 0.5, max: PAPER_MAX_ZOOM };

export interface PaperFit {
  /** `null` ⇒ ρευστό πλάτος (στήλη στενότερη από τη σελίδα). */
  readonly widthPx: number | null;
  readonly zoom: number;
}

/** Ο **τρόπος** του ζουμ — αυτό αποθηκεύεται, όχι ένα ποσοστό: η «Προσαρμογή» ακολουθεί κάθε οθόνη. */
export type PaperZoomMode =
  | { readonly mode: 'fit' }
  | { readonly mode: 'manual'; readonly zoom: number };

export const PAPER_ZOOM_FIT: PaperZoomMode = { mode: 'fit' };

/** Δύο δεκαδικά — όχι αναδιάταξη ανά pixel. */
function twoDecimals(zoom: number): number {
  return Math.floor(zoom * 100) / 100;
}

/** Καθαρή: πόσο πλάτος και ζουμ παίρνει η σελίδα σε στήλη `availablePx`, σε «Προσαρμογή στο πλάτος». */
export function paperFitOf(availablePx: number): PaperFit {
  if (!Number.isFinite(availablePx) || availablePx <= PAPER_A4_WIDTH_PX) return { widthPx: null, zoom: 1 };
  return { widthPx: PAPER_A4_WIDTH_PX, zoom: twoDecimals(Math.min(availablePx / PAPER_A4_WIDTH_PX, PAPER_MAX_ZOOM)) };
}

/**
 * **Ένα** ζουμ για όλες τις γλωσσικές στήλες: η «Προσαρμογή» παίρνει τη **στενότερη** στήλη (καμία δεν ξεχειλίζει, οι
 * γραμμές μένουν παράλληλες)· αν έστω μία είναι στενότερη από Α4, ρέουν όλες.
 */
export function commonPaperFitOf(columnWidthsPx: readonly number[]): PaperFit {
  if (columnWidthsPx.length === 0) return { widthPx: null, zoom: 1 };
  return paperFitOf(Math.min(...columnWidthsPx));
}

/** Η διάταξη της σελίδας για έναν τρόπο ζουμ, σε στήλες με αυτά τα πλάτη. */
export function paperLayoutOf(zoomMode: PaperZoomMode, columnWidthsPx: readonly number[]): PaperFit {
  if (zoomMode.mode === 'fit') return commonPaperFitOf(columnWidthsPx);
  // Στρογγύλευση (όχι κάτω): στο χειροκίνητο δεν υπάρχει στήλη να ξεχειλίσει, και το σκαλί 0,67 πρέπει να μείνει 0,67.
  return { widthPx: PAPER_A4_WIDTH_PX, zoom: Math.round(clampZoom(zoomMode.zoom, PAPER_ZOOM_LIMITS) * 100) / 100 };
}

/** Η μία εγγραφή της διάταξης στο DOM — `{ null, 1 }` επαναφέρει τη ρευστή σελίδα χωρίς ίχνος. */
export function applyPaperLayout(page: HTMLElement, layout: PaperFit): void {
  page.style.width = layout.widthPx === null ? '' : `${layout.widthPx}px`;
  page.style.setProperty('zoom', layout.zoom === 1 ? '' : String(layout.zoom));
}
