/**
 * ADR-650 M4 — Terrain3DStore: the DISPLAY state of the topographic surface in 3D.
 *
 * Deliberately separate from `TopoPointStore`: that one owns the survey DEFINITION (the
 * data), this one owns how the derived surface is DISPLAYED (Civil 3D's Surface ↔ Surface
 * Style split). Toggling the hill off must never touch the survey, and re-styling it must
 * never re-trigger a data write.
 *
 * Pattern: `createExternalStore` vanilla store (ADR-040), mirroring `TopoPointStore` —
 * zero React state; the 3D layer subscribes imperatively, the panel via
 * `useSyncExternalStore` (LOW-freq consumer, not a canvas orchestrator).
 */

import { createExternalStore } from '../../stores/createExternalStore';
import type { TerrainSurfaceStyle } from './topo-types';

export interface Terrain3DState {
  /** Is the terrain mesh drawn in the 3D viewport? Off by default — the user opts in. */
  readonly visible: boolean;
  readonly style: TerrainSurfaceStyle;
  /**
   * ADR-650 M10d — surface transparency (0..1), remembered PER style (Civil 3D keeps transparency
   * on the Surface Style, not globally): so the μονόχρωμο (shaded), υψομετρικό (hypsometric) and
   * cut/fill surfaces each keep the opacity the user last gave them when switched between.
   */
  readonly surfaceOpacity: Readonly<Record<TerrainSurfaceStyle, number>>;
  /** ADR-650 M10d — contour-line transparency (0..1), one value for major+minor together. */
  readonly contourOpacity: number;
  /**
   * ADR-665 — cut the terrain with a horizontal plane at the ACTIVE LEVEL's elevation. The BUILDING
   * is never cut by it. Below the plane the soil stays, so on «Θεμελίωση» the footings read inside
   * the ground; above it the hill is clipped away, so an engineer on the 1st floor is not buried.
   *
   * Default ON: `visible` is already `false` by default, so the default RENDERED scene stays
   * byte-identical to pre-ADR-665 — nothing changes silently. But the moment a user opts into the
   * relief, burying the building is never what they wanted; opt-out is one click, opt-in-to-a-
   * broken-view is a support ticket.
   *
   * Ignored while `floor3DScope === 'all'` — no single active level, and «Όλοι οι όροφοι» IS the
   * site view (whole building + whole ground). See `terrain-clip-math`.
   */
  readonly autoClipAtActiveLevel: boolean;
}

const INITIAL: Terrain3DState = {
  visible: false,
  style: 'shaded',
  surfaceOpacity: { shaded: 1, hypsometric: 1, cutfill: 1 },
  contourOpacity: 1,
  autoClipAtActiveLevel: true,
};

/** Clamp any user/stored input into the valid opacity range; non-finite → fully opaque. */
function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

const store = createExternalStore<Terrain3DState>(INITIAL);

/** Full snapshot (safe as a `useSyncExternalStore` getSnapshot — stable while unchanged). */
export function getTerrain3DState(): Terrain3DState {
  return store.get();
}

/** Show / hide the terrain mesh in 3D. */
export function setTerrain3DVisible(visible: boolean): void {
  const current = store.get();
  if (current.visible === visible) return;
  store.set({ ...current, visible });
}

/** Switch the surface style (flat earth ↔ elevation banding). Triangulation is untouched. */
export function setTerrain3DStyle(style: TerrainSurfaceStyle): void {
  const current = store.get();
  if (current.style === style) return;
  store.set({ ...current, style });
}

/** ADR-650 M10d — the active surface's opacity for a given style (0..1). */
export function getTerrainSurfaceOpacity(style: TerrainSurfaceStyle): number {
  return store.get().surfaceOpacity[style] ?? 1;
}

/** ADR-650 M10d — set the transparency (0..1) of ONE surface style. No-op if unchanged. */
export function setTerrainSurfaceOpacity(style: TerrainSurfaceStyle, opacity: number): void {
  const next = clampOpacity(opacity);
  const current = store.get();
  if (current.surfaceOpacity[style] === next) return;
  store.set({ ...current, surfaceOpacity: { ...current.surfaceOpacity, [style]: next } });
}

/** ADR-650 M10d — set the transparency (0..1) of the contour lines. No-op if unchanged. */
export function setTerrainContourOpacity(opacity: number): void {
  const next = clampOpacity(opacity);
  const current = store.get();
  if (current.contourOpacity === next) return;
  store.set({ ...current, contourOpacity: next });
}

/**
 * ADR-665 — toggle the automatic level cut of the terrain. No-op if unchanged (every notify drives
 * a scene rebuild + a clip re-apply, so the equality guard is load-bearing, not cosmetic).
 */
export function setTerrainAutoClipAtActiveLevel(enabled: boolean): void {
  const current = store.get();
  if (current.autoClipAtActiveLevel === enabled) return;
  store.set({ ...current, autoClipAtActiveLevel: enabled });
}

/** Subscribe to display-state changes; returns unsubscribe. */
export function subscribeTerrain3D(listener: () => void): () => void {
  return store.subscribe(listener);
}
