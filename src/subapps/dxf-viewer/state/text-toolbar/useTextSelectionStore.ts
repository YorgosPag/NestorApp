/**
 * ADR-344 Phase 5.A — Text selection store.
 *
 * Tracks which TEXT/MTEXT entities are currently selected for toolbar
 * editing. Separate from the global entity selection store because the
 * toolbar must distinguish "any entity is selected" from "a text entity
 * is selected" — only the latter activates the toolbar.
 *
 * The actual `DxfTextNode` values are NOT held here. They are resolved
 * lazily by the selector `computeMixedValues` (see textToolbarSelectors.ts)
 * which reads from the scene model.
 */

import { create } from 'zustand';

interface TextSelectionStore {
  selectedIds: readonly string[];
  setSelection: (ids: readonly string[]) => void;
  clear: () => void;
}

export const useTextSelectionStore = create<TextSelectionStore>((set) => ({
  selectedIds: [],
  setSelection: (ids) => set(() => ({ selectedIds: ids })),
  clear: () => set(() => ({ selectedIds: [] })),
}));
