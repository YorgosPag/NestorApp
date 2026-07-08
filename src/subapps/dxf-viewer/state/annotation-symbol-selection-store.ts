/**
 * ADR-583 — Annotation-symbol tool selection store (ribbon ↔ placement).
 *
 * Holds the annotation symbol the North-arrow tool will place next: the catalog
 * `symbolId` (which variant) + the paper `sizeMm`. The ribbon contextual tab
 * writes it; the single-click placement (`handleAnnotationSymbolClick`) reads the
 * live snapshot at click time (getState → no subscription, ADR-040). Defaults to
 * the first catalog north-arrow at the standard 15 mm paper height.
 *
 * @see config/annotation-symbol-catalog.ts — the variant catalog SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-583-annotation-symbol-library-north-arrow.md
 */

import { create } from 'zustand';
import { defaultAnnotationSymbolId } from '../config/annotation-symbol-catalog';
import { DEFAULT_ANNOTATION_SYMBOL_SIZE_MM } from '../types/annotation-symbol';

interface AnnotationSymbolSelectionState {
  /** Catalog id of the variant to place next (e.g. `northArrowSimple`). */
  readonly symbolId: string;
  /** Paper height (mm) the placed symbol gets. */
  readonly sizeMm: number;
  setSymbolId(symbolId: string): void;
  setSizeMm(sizeMm: number): void;
}

export const useAnnotationSymbolSelectionStore = create<AnnotationSymbolSelectionState>((set) => ({
  symbolId: defaultAnnotationSymbolId('north-arrow'),
  sizeMm: DEFAULT_ANNOTATION_SYMBOL_SIZE_MM,
  setSymbolId: (symbolId) => set({ symbolId }),
  setSizeMm: (sizeMm) => set({ sizeMm }),
}));
