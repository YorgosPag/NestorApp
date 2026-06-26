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

interface Grip3DOverlayState {
  /** The reshape grips to draw (footprint vertices + edge-midpoints), or empty. */
  readonly grips: readonly GripInfo[];
  /** Per-grip top-surface elevation (mm) so each square hugs a tilted footprint. */
  readonly elevFor: PlanElevationMmFor;
  /** Replace the grip set + elevation resolver (selection / re-sync). Resets interaction. */
  setGrips(grips: readonly GripInfo[], elevFor: PlanElevationMmFor): void;
  /** Drop all grips (multi-select / unsupported type / deselected). Resets interaction. */
  clear(): void;
}

export const useGrip3DOverlayStore = create<Grip3DOverlayState>((set) => ({
  grips: [],
  elevFor: NO_ELEVATION,
  setGrips: (grips, elevFor) => {
    resetGrip3DInteraction();
    set({ grips: [...grips], elevFor });
  },
  clear: () => {
    resetGrip3DInteraction();
    set({ grips: [], elevFor: NO_ELEVATION });
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
  /**
   * ADR-535 Φ5b — per-grip GPU depth visibility (`visibility[i] === false` ⇒ the grip is
   * occluded by a solid surface, so it is neither drawn nor pickable). Written by the overlay
   * RAF (the one place that runs the GPU occluder), read by the controller's hit-test — one
   * occlusion SSoT. `null` = not computed yet / occlusion off ⇒ every grip is visible.
   */
  visibility: readonly boolean[] | null;
}

export const grip3DOverlayInteraction: Grip3DInteraction = {
  hoverIndex: null,
  drag: null,
  visibility: null,
};

/** True when grip `index` is NOT occluded (or occlusion hasn't run yet). */
export function isGrip3DVisible(index: number): boolean {
  const vis = grip3DOverlayInteraction.visibility;
  return vis === null || vis[index] !== false;
}

/** Clear hover + live-drag + visibility (called on every grip-set rebuild — indices go stale). */
export function resetGrip3DInteraction(): void {
  grip3DOverlayInteraction.hoverIndex = null;
  grip3DOverlayInteraction.drag = null;
  grip3DOverlayInteraction.visibility = null;
}
