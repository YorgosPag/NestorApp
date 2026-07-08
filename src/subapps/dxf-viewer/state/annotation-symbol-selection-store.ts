/**
 * ADR-583 — Annotation-symbol tool selection store (ribbon ↔ placement).
 *
 * Holds the annotation symbol the active placement tool will place next: the
 * catalog `symbolId` (which variant) + paper `sizeMm` + initial `rotationDeg`.
 * The ribbon contextual tab writes it; the single-click placement
 * (`handleAnnotationSymbolClick`) reads the live snapshot at click time
 * (getState → no subscription, ADR-040).
 *
 * **Kind-aware (Φ1):** the top-level triple is the ACTIVE kind's slice, and
 * per-kind slices are remembered in `perKind` so switching tools (north arrow →
 * section mark → …) never leaks the previous kind's variant. `setActiveKind`
 * (driven by the tool-active effect in `ribbon-contextual-config`) saves the
 * current slice and loads the target kind's slice (or its catalog default).
 * The top-level `symbolId`/`sizeMm`/`rotationDeg` shape is preserved so the
 * placement handler + bridge read it unchanged.
 *
 * @see config/annotation-symbol-catalog.ts — the variant catalog SSoT
 * @see config/annotation-kind-registry.ts — kind ↔ tool SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-583-annotation-symbol-library-north-arrow.md
 */

import { create } from 'zustand';
import { defaultAnnotationSymbolId } from '../config/annotation-symbol-catalog';
import { DEFAULT_ANNOTATION_SYMBOL_SIZE_MM } from '../types/annotation-symbol';
import type { AnnotationSymbolKind } from '../types/annotation-symbol';

/** One kind's placement defaults. */
interface AnnotationSymbolSlice {
  readonly symbolId: string;
  readonly sizeMm: number;
  readonly rotationDeg: number;
}

const INITIAL_KIND: AnnotationSymbolKind = 'north-arrow';

/** Fresh catalog-default slice for a kind (first variant, standard paper size). */
function defaultSlice(kind: AnnotationSymbolKind): AnnotationSymbolSlice {
  return {
    symbolId: defaultAnnotationSymbolId(kind),
    sizeMm: DEFAULT_ANNOTATION_SYMBOL_SIZE_MM,
    rotationDeg: 0,
  };
}

interface AnnotationSymbolSelectionState extends AnnotationSymbolSlice {
  /** The kind whose slice is currently exposed at the top level. */
  readonly activeKind: AnnotationSymbolKind;
  /** Remembered slices for the non-active kinds. */
  readonly perKind: Partial<Record<AnnotationSymbolKind, AnnotationSymbolSlice>>;
  /** Swap the active kind (saves the current slice, loads the target's). */
  setActiveKind(kind: AnnotationSymbolKind): void;
  setSymbolId(symbolId: string): void;
  setSizeMm(sizeMm: number): void;
  setRotationDeg(rotationDeg: number): void;
}

export const useAnnotationSymbolSelectionStore = create<AnnotationSymbolSelectionState>((set) => ({
  activeKind: INITIAL_KIND,
  perKind: {},
  ...defaultSlice(INITIAL_KIND),
  setActiveKind: (kind) =>
    set((state) => {
      if (kind === state.activeKind) return state;
      const saved: AnnotationSymbolSlice = {
        symbolId: state.symbolId,
        sizeMm: state.sizeMm,
        rotationDeg: state.rotationDeg,
      };
      const perKind = { ...state.perKind, [state.activeKind]: saved };
      const next = perKind[kind] ?? defaultSlice(kind);
      return { activeKind: kind, perKind, ...next };
    }),
  setSymbolId: (symbolId) => set({ symbolId }),
  setSizeMm: (sizeMm) => set({ sizeMm }),
  setRotationDeg: (rotationDeg) => set({ rotationDeg }),
}));
