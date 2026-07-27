/**
 * TopoPointStore — vanilla SSoT for the RAW survey inputs of the topography subsystem
 * (ADR-650 M1 · extended in M6). Holds, per SURFACE, the survey points (X,Y,Z canonical mm)
 * and the breakline constraints. The TIN surfaces and the contours are DERIVED from this —
 * never stored here (big-player pattern: raw survey is the one source of truth, surface and
 * contours are products).
 *
 * M6 turned the single definition into a **named collection** (`TopoSurfaceId`), exactly the
 * Civil 3D «Surfaces» model: an `existing` ground (what M1–M4 already draw) and a `proposed`
 * one (the designed ground), each with its OWN definition and therefore its own derived TIN.
 * Every legacy write/read keeps working unchanged — they default to `'existing'`.
 *
 * The site `boundary` lives here too but OUTSIDE the definitions: it constrains what the
 * volume computation COUNTS, not how the ground triangulates. Keeping it out of the
 * definition objects is load-bearing — `topo-surface` memoises on their identity, so picking
 * a boundary must not invalidate (and re-triangulate) the surface.
 *
 * Pattern: `createExternalStore` (ADR-040 micro-leaf / vanilla store). Zero React state;
 * consumed via `useSyncExternalStore`. No persistence (points arrive per session).
 */

import { createExternalStore } from '../../stores/createExternalStore';
import { generateEntityId } from '@/services/enterprise-id.service';
import type {
  TopoPoint, Breakline, TopoDefinition, TopoSurfaceId, TopoBoundary, TopoCropPrefs,
} from './topo-types';
import { TOPO_CROP_OFF } from './topo-types';

// ─── State ─────────────────────────────────────────────────────────────────────

export interface TopoPointState {
  readonly surfaces: Readonly<Record<TopoSurfaceId, TopoDefinition>>;
  /** Site boundary (ADR-650 M6 Γ) — earthworks are counted only inside it. `null` = whole survey. */
  readonly boundary: TopoBoundary | null;
  /** ADR-718 — whether that same boundary also CROPS the surface, and how the outside shows. */
  readonly crop: TopoCropPrefs;
}

const EMPTY_DEFINITION: TopoDefinition = { points: [], breaklines: [] };

const EMPTY_STATE: TopoPointState = {
  surfaces: { existing: EMPTY_DEFINITION, proposed: EMPTY_DEFINITION },
  boundary: null,
  crop: TOPO_CROP_OFF,
};

const store = createExternalStore<TopoPointState>(EMPTY_STATE);

/** Replace ONE surface's definition, leaving the other one (and the boundary) untouched. */
function patchDefinition(id: TopoSurfaceId, patch: Partial<TopoDefinition>): void {
  const current = store.get();
  const next: TopoDefinition = { ...current.surfaces[id], ...patch };
  store.set({ ...current, surfaces: { ...current.surfaces, [id]: next } });
}

// ─── Reads ─────────────────────────────────────────────────────────────────────

/** Full snapshot (safe as `useSyncExternalStore` getSnapshot). */
export function getTopoState(): TopoPointState {
  return store.get();
}

/** The raw definition of one surface — the input `topo-surface` memoises its TIN on. */
export function getTopoDefinition(id: TopoSurfaceId = 'existing'): TopoDefinition {
  return store.get().surfaces[id];
}

/** Current survey points of a surface. */
export function getTopoPoints(id: TopoSurfaceId = 'existing'): readonly TopoPoint[] {
  return getTopoDefinition(id).points;
}

/** Current breakline constraints of a surface. */
export function getTopoBreaklines(id: TopoSurfaceId = 'existing'): readonly Breakline[] {
  return getTopoDefinition(id).breaklines;
}

/** The site boundary, or `null` when volumes cover the whole survey. */
export function getTopoBoundary(): TopoBoundary | null {
  return store.get().boundary;
}

/** ADR-718 — the crop preferences. Always an object; `TOPO_CROP_OFF` when nothing is set. */
export function getTopoCrop(): TopoCropPrefs {
  return store.get().crop;
}

/**
 * The ring the surface is actually cropped to, or `null` when it is not cropped at all —
 * the ONE place that answers «is the crop live right now?».
 *
 * Both conditions live here on purpose: crop-on without a picked boundary means the user asked
 * for a cut and has not said where yet. Each consumer answering that separately is how one of
 * them ends up cropping to a boundary the others ignore.
 */
export function getActiveCropRing(): TopoBoundary | null {
  const { boundary, crop } = store.get();
  return crop.enabled && boundary && boundary.vertices.length >= 3 ? boundary : null;
}

// ─── Writes ────────────────────────────────────────────────────────────────────

/** Replace ALL points of a surface (e.g. a fresh file load). Its breaklines are preserved. */
export function setTopoPoints(points: readonly TopoPoint[], id: TopoSurfaceId = 'existing'): void {
  patchDefinition(id, { points: [...points] });
}

/** Append points to a surface's existing set. */
export function addTopoPoints(points: readonly TopoPoint[], id: TopoSurfaceId = 'existing'): void {
  patchDefinition(id, { points: [...getTopoPoints(id), ...points] });
}

/** Replace ALL breaklines of a surface. Its points are preserved. */
export function setTopoBreaklines(breaklines: readonly Breakline[], id: TopoSurfaceId = 'existing'): void {
  patchDefinition(id, { breaklines: [...breaklines] });
}

/**
 * Add one breakline from an ordered vertex list, minting an enterprise id (ADR-017/N.6).
 * Returns the new breakline id. Vertices with fewer than 2 points are rejected (no id).
 *
 * ADR-650 M2-Β: `sourceEntityId` records the scene entity the breakline was picked from,
 * so the tool can toggle it off on a second click and highlight it back.
 */
export function addBreakline(
  vertices: readonly TopoPoint[],
  closed = false,
  sourceEntityId?: string,
  id: TopoSurfaceId = 'existing',
): string | null {
  if (vertices.length < 2) return null;
  const breaklineId = generateEntityId();
  const breakline: Breakline = { id: breaklineId, vertices: [...vertices], closed, sourceEntityId };
  patchDefinition(id, { breaklines: [...getTopoBreaklines(id), breakline] });
  return breaklineId;
}

/** Remove one breakline by id. No-op (and `false`) when the id is unknown. */
export function removeBreakline(breaklineId: string, id: TopoSurfaceId = 'existing'): boolean {
  const current = getTopoBreaklines(id);
  const next = current.filter((b) => b.id !== breaklineId);
  if (next.length === current.length) return false;
  patchDefinition(id, { breaklines: next });
  return true;
}

/** The breakline picked from a given scene entity, if any (ADR-650 M2-Β toggle). */
export function findBreaklineBySourceEntity(
  entityId: string,
  id: TopoSurfaceId = 'existing',
): Breakline | undefined {
  return getTopoBreaklines(id).find((b) => b.sourceEntityId === entityId);
}

/** Set (or clear, with `null`) the site boundary. Never touches a surface definition. */
export function setTopoBoundary(boundary: TopoBoundary | null): void {
  store.set({ ...store.get(), boundary });
}

/**
 * ADR-718 — patch the crop preferences. Turning the crop OFF also drops `showOutside`, so the
 * faded backdrop cannot survive as a hidden setting that reappears the next time cropping is
 * switched on (the user turned the whole feature off; the sub-setting is not theirs to remember).
 */
export function setTopoCrop(patch: Partial<TopoCropPrefs>): void {
  const current = store.get();
  const merged: TopoCropPrefs = { ...current.crop, ...patch };
  const next = merged.enabled ? merged : TOPO_CROP_OFF;
  if (next.enabled === current.crop.enabled && next.showOutside === current.crop.showOutside) return;
  store.set({ ...current, crop: next });
}

/** Clear every surface AND the boundary back to empty. */
export function clearTopo(): void {
  store.set(EMPTY_STATE);
}

// ─── Subscription ────────────────────────────────────────────────────────────────

/** Subscribe to state changes; returns unsubscribe (useSyncExternalStore-compatible). */
export function subscribeTopo(listener: () => void): () => void {
  return store.subscribe(listener);
}
