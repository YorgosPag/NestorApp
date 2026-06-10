/**
 * MepCircuitEditorStore — which existing circuit the Φ6 management UI is editing.
 *
 * The `MepSystemStore` owns the circuits themselves (truth); this tiny store
 * owns only the *ephemeral UI selection* — "which circuit is currently shown in
 * the contextual ribbon's Circuit-Properties panel". That choice is genuinely
 * not derivable from the scene when a panel sources more than one circuit (the
 * user must pick), so it lives in its own store rather than as a pure selector.
 *
 * `useMepCircuitEditorSync` reconciles `activeSystemId` against the live
 * candidates (selection → systems); the picker widget sets it explicitly. Zero
 * high-frequency subscriptions — CHECK 6B/6C safe.
 *
 * @see ./mep-circuit-editor.ts
 * @see ../../hooks/data/useMepCircuitEditorSync.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

/** Shared empty set — referential-stable so a "cleared" selection never re-notifies. */
const EMPTY_SELECTION: ReadonlySet<string> = new Set<string>();

export interface MepCircuitEditorStoreState {
  /**
   * The **primary** circuit (`MepSystem.id`) — what the Circuit-Properties panel edits and
   * what waypoint editing targets. Always a member of `selectedSystemIds` (or `null`).
   */
  readonly activeSystemId: string | null;
  /**
   * ALL highlighted circuits (Revit-style multi-select via window/crossing). A single click
   * selects one (`{id}`); a marquee can select several. The 2D wire overlay lights the grips
   * of every member; the primary (`activeSystemId`) additionally owns the editing affordances.
   */
  readonly selectedSystemIds: ReadonlySet<string>;
  /** Single-select (click / sync / deselect): primary = `id`, selection = `{id}` (or empty). */
  setActiveSystemId(systemId: string | null): void;
  /** Multi-select (marquee): selection = `systemIds`, primary = the last (top-most paint order). */
  setSelectedCircuits(systemIds: readonly string[]): void;
  getActiveSystemId(): string | null;
}

export const useMepCircuitEditorStore = create<MepCircuitEditorStoreState>()(
  subscribeWithSelector((set, get) => ({
    activeSystemId: null,
    selectedSystemIds: EMPTY_SELECTION,
    setActiveSystemId: (systemId) => {
      const { activeSystemId, selectedSystemIds } = get();
      // No-op only when BOTH the primary and the highlight set already match — keeps the set
      // referentially stable so the overlay never repaints on a redundant set.
      const setMatches = systemId === null
        ? selectedSystemIds.size === 0
        : selectedSystemIds.size === 1 && selectedSystemIds.has(systemId);
      if (activeSystemId === systemId && setMatches) return;
      set({
        activeSystemId: systemId,
        selectedSystemIds: systemId ? new Set([systemId]) : EMPTY_SELECTION,
      });
    },
    setSelectedCircuits: (systemIds) => {
      if (systemIds.length === 0) {
        if (get().activeSystemId === null && get().selectedSystemIds.size === 0) return;
        set({ activeSystemId: null, selectedSystemIds: EMPTY_SELECTION });
        return;
      }
      // Primary = last (top-most in paint order — matches the wire-click tie-break).
      set({
        activeSystemId: systemIds[systemIds.length - 1]!,
        selectedSystemIds: new Set(systemIds),
      });
    },
    getActiveSystemId: () => get().activeSystemId,
  })),
);
