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
import type { PlanElevationMmFor, GripWorldOffset } from '../grips/grip-3d-screen-project';

/** Default elevation resolver (flat, datum 0) used when no grips are mounted. */
const NO_ELEVATION: PlanElevationMmFor = () => 0;

interface Grip3DOverlayState {
  /** The reshape grips to draw (footprint vertices + edge-midpoints), or empty. */
  readonly grips: readonly GripInfo[];
  /**
   * Per-grip TOP-surface elevation (mm) so each square hugs a tilted footprint. ADR-535 Φ6 —
   * each grip is now drawn TWICE (twin: top + bottom face), one elevation resolver per surface.
   */
  readonly topElevFor: PlanElevationMmFor;
  /** Per-grip BOTTOM-surface elevation (mm) = top − thickness (ADR-535 Φ6 twin grips). */
  readonly bottomElevFor: PlanElevationMmFor;
  /**
   * ADR-537 — when the seated grips belong to RAW DXF entities (line/polyline/circle/arc),
   * their ids (so the overlay can stroke a live ghost of the entity-in-progress during a grip
   * drag). ADR-543 — a list, because TWO selected lines (articulated joint) seat grips for
   * BOTH. Empty `[]` for BIM grips (the BIM path has its own live mesh preview). Reset by
   * `setGrips` / `clear`; the DXF seater sets it explicitly via `setDxfGhostEntityIds`.
   */
  readonly dxfGhostEntityIds: readonly string[];
  /**
   * ADR-535 Φ11 — constant WORLD plan-shift of the TOP grips (the base/bottom stays). Non-null
   * only for a battered (tilted) wall, whose top face is sheared ⟂ to the run. `null` = flat-top
   * (top sits straight above the base). Low-frequency (changes on selection / re-sync, like the
   * elevation resolvers), so it lives here, not in the high-frequency interaction singleton.
   */
  readonly topWorldShift: GripWorldOffset | null;
  /** Replace the grip set + top/bottom elevation resolvers + top tilt-shift (selection / re-sync). Resets interaction + ghost. */
  setGrips(
    grips: readonly GripInfo[],
    topElevFor: PlanElevationMmFor,
    bottomElevFor: PlanElevationMmFor,
    topWorldShift?: GripWorldOffset | null,
  ): void;
  /** ADR-537/543 — mark the seated grips as belonging to raw DXF entities `ids` (ghost sources), or []. */
  setDxfGhostEntityIds(ids: readonly string[]): void;
  /** Drop all grips (multi-select / unsupported type / deselected). Resets interaction + ghost. */
  clear(): void;
}

export const useGrip3DOverlayStore = create<Grip3DOverlayState>((set) => ({
  grips: [],
  topElevFor: NO_ELEVATION,
  bottomElevFor: NO_ELEVATION,
  dxfGhostEntityIds: [],
  topWorldShift: null,
  setGrips: (grips, topElevFor, bottomElevFor, topWorldShift = null) => {
    resetGrip3DInteraction();
    // ADR-537 — a new grip set is BIM by default; the DXF seater opts in afterwards.
    set({ grips: [...grips], topElevFor, bottomElevFor, topWorldShift, dxfGhostEntityIds: [] });
  },
  setDxfGhostEntityIds: (dxfGhostEntityIds) => set({ dxfGhostEntityIds: [...dxfGhostEntityIds] }),
  clear: () => {
    resetGrip3DInteraction();
    set({ grips: [], topElevFor: NO_ELEVATION, bottomElevFor: NO_ELEVATION, topWorldShift: null, dxfGhostEntityIds: [] });
  },
}));

/**
 * High-frequency interaction state for the 3D grip overlay (ADR-040: zero React state).
 *
 * ADR-535 Φ6 — each footprint grip is a TWIN (one square on the top face, one on the bottom).
 * The `N` plan grips therefore span `2N` CONCEPTUAL grips in a single FLAT index space:
 * `0…N-1` = TOP surface, `N…2N-1` = BOTTOM surface (bottom of plan grip `i` ⇒ flat `i + N`).
 * `hoverIndex` / `drag.index` are flat indices; `visibility` is length `2N`. The base plan
 * grip is `flat % N`, the surface is `flat >= N ? 'bottom' : 'top'`. This keeps the shape
 * unchanged (plain `number` indices, `boolean[]`) — top & bottom are the SAME command.
 * `livePlanPos` is the snapped plan position the dragged vertex renders at. Mutated by the
 * controller, read by the overlay RAF — never via React.
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
  /**
   * ADR-535 Φ10 / ADR-516 — live RIGID-move world translation applied to the gizmo'd entity's
   * mesh during a MOVE drag. The overlay RAF shifts EVERY grip by this same world delta so the
   * squares stay glued to the moving entity (ghost === grips — big-player handle-follow). `null`
   * = no move in flight (static / reshape / committed). Set by `applyLivePreview` (move branch),
   * cleared on drag settle; the commit re-sync re-seats the grips at the new position.
   */
  liveMoveWorld: GripWorldOffset | null;
}

export const grip3DOverlayInteraction: Grip3DInteraction = {
  hoverIndex: null,
  drag: null,
  visibility: null,
  liveMoveWorld: null,
};

/**
 * ADR-535 Φ10 / ADR-516 — set (or clear with `null`) the live rigid-move world offset for the
 * grip overlay. Mutates the non-reactive singleton (zero React state); the overlay RAF reads it
 * each frame so the grips follow the moving entity with no re-render.
 */
export function setGrip3DLiveMoveWorld(offset: GripWorldOffset | null): void {
  grip3DOverlayInteraction.liveMoveWorld = offset;
}

/** True when FLAT grip `index` (top/bottom, see {@link Grip3DInteraction}) is NOT occluded. */
export function isGrip3DVisible(index: number): boolean {
  const vis = grip3DOverlayInteraction.visibility;
  return vis === null || vis[index] !== false;
}

/** Clear hover + live-drag + visibility (called on every grip-set rebuild — indices go stale). */
export function resetGrip3DInteraction(): void {
  grip3DOverlayInteraction.hoverIndex = null;
  grip3DOverlayInteraction.drag = null;
  grip3DOverlayInteraction.visibility = null;
  grip3DOverlayInteraction.liveMoveWorld = null; // ADR-535 Φ10 — re-seated grips drop any live offset.
}
