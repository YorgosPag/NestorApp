/**
 * stair-sub-element-selection-store — SSoT for per-tread / per-riser sub-element
 * selection WITHIN one parametric `StairEntity` (ADR-358 Q19 "click-on-canvas"
 * carryover; Revit / ArchiCAD "click-into components").
 *
 * DESIGN (big-player practice, ADR-358): the stair stays ONE parametric object —
 * it is NEVER exploded into per-step entities. Sub-element selection is a purely
 * transient VIEW concern (which tread/riser is being edited); the durable data
 * lives in `StairParams.perTreadOverrides` and is written through the existing
 * `dispatchStairParamPatch` → `UpdateStairParamsCommand` SSoT.
 *
 * Two-tier (ADR-040 micro-leaf), mirroring `Grip3DOverlayStore`:
 *   - The SELECTED sub-element is LOW-frequency (changes only on click / Tab / Esc),
 *     so it lives in a small zustand store that the 2D + 3D highlight leaves
 *     subscribe to.
 *   - The HOVERED sub-element is HIGH-frequency (every pointer move), so it lives
 *     in a NON-REACTIVE mutable singleton (mirror `HoverStore` /
 *     `grip3DOverlayInteraction` — "zero React state"): pointer handlers MUTATE it,
 *     the highlight redraw READS it, so hover follows with ZERO re-render.
 *
 * ONE store shared by 2D and 3D (SSoT — "3D mirrors 2D"). It lives in the domain
 * layer (`bim/stairs/`) so neither the 2D renderer nor the 3D scene depends on the
 * other's layer. Cleared whenever the whole-entity selection moves away from
 * `stairId` or is dropped (wired by the selection sync, Φ1/Φ3).
 */

import { create } from 'zustand';

/** The editable sub-parts of a stair (Φ1 scope — finish-level per-element edits). */
export type StairSubPart = 'tread' | 'riser';

/** Narrow a raw `userData.stairComponent` string to an editable {@link StairSubPart}. */
export function isStairSubPart(value: string | undefined): value is StairSubPart {
  return value === 'tread' || value === 'riser';
}

/** A stable reference to one sub-element of one stair (0-based geometry index). */
export interface StairSubElementRef {
  readonly stairId: string;
  readonly part: StairSubPart;
  readonly index: number;
}

/** Structural equality for two sub-element refs (highlight-leaf equality guard). */
export function isSameStairSubElement(
  a: StairSubElementRef | null,
  b: StairSubElementRef | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.stairId === b.stairId && a.part === b.part && a.index === b.index;
}

interface StairSubSelectionState {
  /** The currently selected sub-element, or `null` (whole-stair / nothing). */
  readonly selected: StairSubElementRef | null;
  /** Select a sub-element (2nd click into an already-selected stair). Resets hover. */
  selectSub(ref: StairSubElementRef): void;
  /** Drop the sub-element selection (Esc one level / whole-selection change). Resets hover. */
  clear(): void;
  /**
   * Tab-cycle to the next sub-element of the same part within the current stair.
   * `count` = number of that part (e.g. `stepCount` for treads). No-op if nothing
   * is selected or `count <= 0`. Wraps around modulo `count`.
   */
  cycleNext(count: number): void;
}

export const useStairSubElementSelectionStore = create<StairSubSelectionState>((set) => ({
  selected: null,
  selectSub: (ref) => {
    resetStairSubElementHover();
    set({ selected: ref });
  },
  clear: () => {
    resetStairSubElementHover();
    set({ selected: null });
  },
  cycleNext: (count) =>
    set((s) => {
      const cur = s.selected;
      if (!cur || count <= 0) return {};
      return { selected: { ...cur, index: (cur.index + 1) % count } };
    }),
}));

/**
 * High-frequency HOVER state for stair sub-elements (ADR-040: zero React state).
 * Pointer handlers mutate `ref` on every move; the 2D/3D highlight redraw reads it.
 * Never routed through React — a hover must not trigger a re-render.
 */
export interface StairSubElementHoverState {
  ref: StairSubElementRef | null;
}

export const stairSubElementHover: StairSubElementHoverState = { ref: null };

/** Set (or clear with `null`) the hovered sub-element. Mutates the non-reactive singleton. */
export function setStairSubElementHover(ref: StairSubElementRef | null): void {
  stairSubElementHover.ref = ref;
}

/** Clear the hovered sub-element (deselect / stair change / pointer leave). */
export function resetStairSubElementHover(): void {
  stairSubElementHover.ref = null;
}
