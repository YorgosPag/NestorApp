/**
 * Ο **προέλεγχος εκτύπωσης** (ADR-923 §5.3): εικόνα κάτω από 300 dpi στο τυπωμένο μέγεθος · εικόνα που δεν είναι CMYK στο
 * προφίλ εκτύπωσης (RGB JPEG θα έμπαινε αυτούσιο σε CMYK αρχείο). Δεν μπλοκάρει: **μετρά** και η έκδοση το δείχνει.
 * @module subapps/catalog/publishing/publication-preflight
 */

import type { LayoutDocument, LayoutImageRef } from './layout-model';

export const PRINT_MIN_DPI = 300;
const MM_PER_INCH = 25.4;

export interface PlacedImageFacts {
  readonly widthPx: number;
  readonly colourModel: string;
}

function placedImages(document: Pick<LayoutDocument, 'sections'>): LayoutImageRef[] {
  return document.sections.flatMap((section) => section.blocks.flatMap((block) => {
    if (block.kind === 'image') return [block.image];
    return block.kind === 'grid' ? block.cards.flatMap((card) => (card.image ? [card.image] : [])) : [];
  }));
}

/** Πίνακες όπου η αναστροφή που δήλωσε η οικογένεια δεν χώρεσε. Μετρά τον πίνακα μία φορά, όσα μέρη κι αν έχει. */
export function countUntransposedTables(document: Pick<LayoutDocument, 'sections'>): number {
  return document.sections.flatMap((section) => section.blocks)
    .filter((block) => block.kind === 'table' && block.table.transposeUnmet && block.table.part === 1).length;
}

export function placedDpi(widthPx: number, widthMm: number): number {
  return widthPx / (widthMm / MM_PER_INCH);
}

/** Μετρά ανά **τοποθέτηση**: η ίδια εικόνα σε δύο μεγέθη κρίνεται δύο φορές· ένα χρώμα ανά μέσο. */
export function preflightPrintImages(
  document: Pick<LayoutDocument, 'sections'>,
  factsOf: (assetId: string) => PlacedImageFacts | null,
): { readonly lowResolutionImageCount: number; readonly nonCmykImageCount: number } {
  const placed = placedImages(document);
  const low = placed.filter((image) => {
    const facts = factsOf(image.assetId);
    return facts !== null && placedDpi(facts.widthPx, image.widthMm) < PRINT_MIN_DPI;
  });
  const assetIds = [...new Set(placed.map((image) => image.assetId))];
  const nonCmyk = assetIds.filter((id) => { const facts = factsOf(id); return facts !== null && facts.colourModel !== 'cmyk'; });
  return { lowResolutionImageCount: low.length, nonCmykImageCount: nonCmyk.length };
}
