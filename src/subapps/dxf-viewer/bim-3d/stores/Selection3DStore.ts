/**
 * Selection3DStore — click-selection state for the 3D viewport BIM entity panel.
 *
 * Updated by ThreeJsSceneManager.selectBimEntity()/toggleBimEntity() on click raycast.
 * Consumed by BimEntityCardPanel (ADR-040 micro-leaf).
 *
 * ADR-366 A.1. ADR-402 Phase C — widened single→multi (Shift+click).
 *
 * Canonical state is `selectedBimIds` (insertion-ordered) + `selectedBimTypes`
 * (id→type). `selectedBimId`/`selectedBimType` are derived **real fields** (= the
 * primary / first-selected entity), kept in sync inside every action so legacy
 * single-select consumers + `subscribeWithSelector` diffing keep working unchanged.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface Selection3DState {
  /** Canonical multi-selection (insertion-ordered; [0] = primary). */
  selectedBimIds: string[];
  /** id → bimType for every selected entity. */
  selectedBimTypes: Record<string, string>;
  /** Derived (compat): primary selected id = selectedBimIds[0] ?? null. */
  selectedBimId: string | null;
  /** Derived (compat): primary selected type. */
  selectedBimType: string | null;
}

interface Selection3DActions {
  /** Replace the whole selection with a single entity (plain click). */
  selectEntity(bimId: string, bimType: string): void;
  /** Add/remove an entity from the selection (Shift+click). */
  toggleEntity(bimId: string, bimType: string): void;
  clearSelection(): void;
}

type Selection3DStoreType = Selection3DState & Selection3DActions;

/** Derive the compat primary fields from the canonical multi-selection. */
function derivePrimary(
  ids: string[],
  types: Record<string, string>,
): Pick<Selection3DState, 'selectedBimId' | 'selectedBimType'> {
  const primary = ids[0] ?? null;
  return {
    selectedBimId: primary,
    selectedBimType: primary !== null ? (types[primary] ?? null) : null,
  };
}

export const useSelection3DStore = create<Selection3DStoreType>()(
  subscribeWithSelector((set) => ({
    selectedBimIds: [],
    selectedBimTypes: {},
    selectedBimId: null,
    selectedBimType: null,

    selectEntity: (bimId, bimType) => {
      const ids = [bimId];
      const types = { [bimId]: bimType };
      set({ selectedBimIds: ids, selectedBimTypes: types, ...derivePrimary(ids, types) });
    },

    toggleEntity: (bimId, bimType) =>
      set((s) => {
        const has = s.selectedBimIds.includes(bimId);
        const ids = has
          ? s.selectedBimIds.filter((id) => id !== bimId)
          : [...s.selectedBimIds, bimId];
        const types = { ...s.selectedBimTypes };
        if (has) delete types[bimId];
        else types[bimId] = bimType;
        return { selectedBimIds: ids, selectedBimTypes: types, ...derivePrimary(ids, types) };
      }),

    clearSelection: () =>
      set({ selectedBimIds: [], selectedBimTypes: {}, selectedBimId: null, selectedBimType: null }),
  })),
);
