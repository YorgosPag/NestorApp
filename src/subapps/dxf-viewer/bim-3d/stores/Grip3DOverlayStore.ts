/**
 * Grip3DOverlayStore — state for the 3D reshape-grip Canvas2D overlay (ADR-535 Φ5).
 *
 * Two-tier store (ADR-040 micro-leaf): the grip SET + its per-vertex elevation resolver
 * are LOW-frequency (change only on selection / commit re-sync), so they live in a small
 * zustand store the overlay subscribes to (to start / stop its RAF loop). The HOVER index
 * and the LIVE drag position are HIGH-frequency (every pointer move / frame), so they live
 * in a NON-REACTIVE mutable singleton (mirror `HoverStore` / `ImmediatePositionStore` —
 * "zero React state"): the non-React controller MUTATES it on pointer events, the overlay
 * RAF READS it each frame, so the dragged square + hover highlight follow with ZERO
 * re-render. The interaction is reset whenever the grip set is rebuilt.
 */

import { create } from 'zustand';
import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo } from '../../hooks/grip-types';
import type { PlanElevationMmFor } from '../grips/grip-3d-screen-project';

/** Default elevation resolver (flat, datum 0) used when no grips are mounted. */
const NO_ELEVATION: PlanElevationMmFor = () => 0;
const NO_SELF_IDS: ReadonlySet<string> = new Set();

interface Grip3DOverlayState {
  /** The reshape grips to draw (footprint vertices + edge-midpoints), or empty. */
  readonly grips: readonly GripInfo[];
  /** Per-grip top-surface elevation (mm) so each square hugs a tilted footprint. */
  readonly elevFor: PlanElevationMmFor;
  /**
   * `bimId`s whose meshes must NOT occlude the grips (the edited entity + e.g. a
   * slab-opening's host slab) — so an entity never hides its own grips (ADR-535 Φ5).
   */
  readonly selfIds: ReadonlySet<string>;
  /** Replace the grip set + elevation resolver + self-ids (selection / re-sync). Resets interaction. */
  setGrips(grips: readonly GripInfo[], elevFor: PlanElevationMmFor, selfIds: ReadonlySet<string>): void;
  /** Drop all grips (multi-select / unsupported type / deselected). Resets interaction. */
  clear(): void;
}

export const useGrip3DOverlayStore = create<Grip3DOverlayState>((set) => ({
  grips: [],
  elevFor: NO_ELEVATION,
  selfIds: NO_SELF_IDS,
  setGrips: (grips, elevFor, selfIds) => {
    resetGrip3DInteraction();
    set({ grips: [...grips], elevFor, selfIds });
  },
  clear: () => {
    resetGrip3DInteraction();
    set({ grips: [], elevFor: NO_ELEVATION, selfIds: NO_SELF_IDS });
  },
}));

/**
 * High-frequency interaction state for the 3D grip overlay (ADR-040: zero React state).
 * `hoverIndex` / `drag.index` are ARRAY indices into the current `grips`; `livePlanPos`
 * is the snapped plan position the dragged square renders at. Mutated by the controller,
 * read by the overlay RAF — never via React.
 */
export interface Grip3DInteraction {
  hoverIndex: number | null;
  drag: { readonly index: number; livePlanPos: Point2D } | null;
}

export const grip3DOverlayInteraction: Grip3DInteraction = {
  hoverIndex: null,
  drag: null,
};

/** Clear hover + live-drag (called on every grip-set rebuild — indices would go stale). */
export function resetGrip3DInteraction(): void {
  grip3DOverlayInteraction.hoverIndex = null;
  grip3DOverlayInteraction.drag = null;
}
