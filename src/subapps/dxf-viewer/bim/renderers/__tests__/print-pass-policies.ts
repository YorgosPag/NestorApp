/**
 * Οι πολιτικές εκτύπωσης που ζητούν οι άγκυρες «χαρτί» των ζωγράφων (ADR-909 Γ2.5): η **δημόσια κάτοψη**
 * (δάπεδο πάχους 4 px + δάπεδο αντίθεσης 3:1) και το **PDF του μηχανικού** (κανένα από τα δύο δάπεδα).
 *
 * Όχι αρχείο test: βοήθημα που το μοιράζονται οι σουίτες (το jscpd αγνοεί τα `__tests__`, άρα το ίδιο σώμα
 * γραμμένο σε κάθε σουίτα δεν θα το έπιανε καμία πύλη — αδελφός του `recording-canvas.ts`).
 */

import { contrastRatio, parseColor, saturation } from '../../../config/color-math';
import { MIN_ENTITY_CONTRAST } from '../../../config/contrast-adaptation';
import { PRINT_PAPER_HEX, type PrintColorPolicy } from '../../../config/print-color-policy';

/** Το δάπεδο πάχους της δημόσιας κάτοψης (`PUBLIC_FLOORPLAN_MIN_LINE_WIDTH_PX`). */
export const FLOOR_PX = 4;
/** Το DPI της δημόσιας εικόνας των 4096 px. */
export const PUBLIC_IMAGE_DPI = 694;
export const PLOT_STYLES: ReadonlyArray<PrintColorPolicy['style']> = ['monochrome', 'grayscale', 'colour'];

export const publicImage = (style: PrintColorPolicy['style']): PrintColorPolicy => ({
  style, dpi: PUBLIC_IMAGE_DPI, minLineWidthPx: FLOOR_PX, minInkContrast: MIN_ENTITY_CONTRAST,
});

/** PDF του μηχανικού: άχρωμο, **χωρίς** δάπεδο πάχους 4 px και χωρίς δάπεδο αντίθεσης. */
export const ENGINEER_PDF: PrintColorPolicy = { style: 'monochrome', dpi: 300 };

export const onPaper = (color: string): number => contrastRatio(color, PRINT_PAPER_HEX);
export const isGrey = (color: string): boolean => saturation(parseColor(color)!) === 0;
export const isOpaque = (color: string): boolean => parseColor(color)!.a === 1;
