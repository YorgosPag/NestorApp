/**
 * railing-component-selection-store — ADR-407 Φ8 SSoT για την «click-into» επιλογή ΕΝΟΣ component
 * (κουπαστή/κάγκελα/κολόνες) μέσα σε ΕΝΑ `RailingEntity` (Revit/ArchiCAD «click-into components»).
 *
 * DESIGN (mirror του stair-sub-element pattern, big-player two-tier): το κάγκελο μένει ΕΝΑ
 * παραμετρικό object — ΠΟΤΕ δεν σπάει σε per-component entities. Η επιλογή component είναι καθαρά
 * transient VIEW concern (ποιο component βάφεται)· το durable data ζει στο
 * `RailingParams.componentAppearance` και γράφεται μέσω `UpdateRailingParamsCommand`
 * (`apply-railing-appearance`). Low-frequency (αλλάζει μόνο σε κλικ / Esc) → μικρό zustand store που
 * ο panel + το paint routing διαβάζουν. Λιτό: 3 σταθερά components → χωρίς index/Tab-cycle/hover
 * singleton (σε αντίθεση με τη σκάλα που έχει N treads).
 *
 * @see ./railing-types.ts — RailingComponent ('post'|'baluster'|'rail')
 * @see bim-3d/ui/apply-railing-appearance.ts — ο writer (componentAppearance)
 * @see bim/stairs/stair-sub-element-selection-store.ts — το ανάλογο της σκάλας
 */

import { create } from 'zustand';
import type { RailingComponent } from '../types/railing-types';

/** Narrow a raw `userData.railingComponent` string to a {@link RailingComponent}. */
export function isRailingComponent(value: string | undefined): value is RailingComponent {
  return value === 'post' || value === 'baluster' || value === 'rail';
}

/** A stable reference to one component of one railing. */
export interface RailingComponentRef {
  readonly railingId: string;
  readonly component: RailingComponent;
}

/** Structural equality for two component refs. */
export function isSameRailingComponent(
  a: RailingComponentRef | null,
  b: RailingComponentRef | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.railingId === b.railingId && a.component === b.component;
}

interface RailingComponentSelectionState {
  /** The currently selected railing component, or `null` (whole-railing / nothing). */
  readonly selected: RailingComponentRef | null;
  /** Select a component (2nd click into an already-selected railing under «ΠΟΛΥΓΩΝΑ»). */
  selectComponent(ref: RailingComponentRef): void;
  /** Drop the component selection (Esc one level / whole-selection change / miss). */
  clear(): void;
}

export const useRailingComponentSelectionStore = create<RailingComponentSelectionState>((set) => ({
  selected: null,
  selectComponent: (ref) => set({ selected: ref }),
  clear: () => set({ selected: null }),
}));
