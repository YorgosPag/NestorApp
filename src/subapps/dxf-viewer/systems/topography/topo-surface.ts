/**
 * ADR-650 M4 (extended M6, cropped in ADR-718) — the derived surfaces. SSoT for «what is the
 * current TIN?».
 *
 * Big-player model (Civil 3D «Surface»): a surface is not stored geometry — it is a
 * DEFINITION (survey points + breaklines, here one entry of `TopoPointStore.surfaces`) plus
 * a DERIVED triangulation that is rebuilt whenever the definition changes («Rebuild
 * Surface»). Everything you can *see* — contours, 3D faces, elevation banding, cut/fill
 * analysis — is a STYLE over that surface, never a second triangulation.
 *
 * This module is that surface — one per `TopoSurfaceId`. Each is memoised on the identity of
 * its OWN definition object (every write replaces it), so the contour generator, the 3D
 * terrain layer and the volume engine consume the **same `TinSurface` instance**. Without it
 * each consumer would call `buildTin` on its own and the hill in 3D could silently disagree
 * with the contours drawn in plan — the exact failure ADR-650 §12.2 calls out.
 *
 * M6 note: `existing` and `proposed` are two DIFFERENT definitions, so two TINs is correct
 * and expected. What stays forbidden is triangulating the SAME definition twice.
 *
 * ── ADR-718: two floors, not two engines ────────────────────────────────────────────────────
 * The site crop must NOT re-triangulate — picking or dragging a boundary is a display/scope
 * decision, and re-running the CDT on every boundary edit would be both slow and a licence for
 * the triangulation to drift while the survey stood still. So the memo is two-storey:
 *
 *   floor 1  definition → surveyed TIN        (invalidated by survey edits only)
 *   floor 2  surveyed TIN + ring → cropped TIN (invalidated by boundary/crop edits only)
 *
 * `getTopoSurface()` keeps its name and its meaning — «the surface as it currently stands» — so
 * every existing consumer (plan footprint, contours, 3D terrain, cut cap, areas, volumes) obeys
 * the crop **without a single line changing in any of them**. That is the whole reason the crop
 * is implemented here and not in eight places.
 *
 * Cheap by construction: no definition change → no rebuild; no boundary change → no re-clip.
 */

import { getTopoDefinition, getActiveCropRing } from './TopoPointStore';
import { buildTin } from './tin-builder';
import { clipTinToBoundary } from './tin-clip-to-boundary';
import type { TinSurface, TopoBoundary, TopoDefinition, TopoSurfaceId } from './topo-types';

interface BuildMemo {
  readonly input: TopoDefinition;
  readonly surface: TinSurface;
}

interface CropMemo {
  readonly source: TinSurface;
  readonly ring: TopoBoundary | null;
  readonly surface: TinSurface;
}

const buildMemos = new Map<TopoSurfaceId, BuildMemo>();
const cropMemos = new Map<TopoSurfaceId, CropMemo>();

/**
 * The **surveyed** TIN — everything the topographer measured, never cropped.
 *
 * Consumers:
 *   - the survey DELIVERABLES (`deliverables/useSurveyExport`) — ⚠️ an export is a record of
 *     what was measured. Cropping it would hand the client a smaller survey than the one that
 *     was paid for and surveyed, which is a data-integrity problem, not a display preference.
 *
 * ⏳ Μ5 will add a second one — the faded «surrounding ground» backdrop (`crop.showOutside`),
 * whose entire job is to show what the crop removed. The preference is already stored and
 * toggleable; **nothing renders it yet**, so do not read that flag as «a backdrop is on screen».
 *
 * Anything else wanting «the surface» wants {@link getTopoSurface}.
 *
 * The deliverables' exclusive use of this door is anchored in
 * `deliverables/__tests__/deliverables-use-full-surface.test.ts` (import-level, so the NEXT
 * deliverable producer is covered too, not just today's).
 */
export function getTopoSurfaceFull(id: TopoSurfaceId = 'existing'): TinSurface {
  const input = getTopoDefinition(id);
  const memo = buildMemos.get(id);
  if (memo && memo.input === input) return memo.surface;

  const surface = buildTin(input.points, input.breaklines);
  buildMemos.set(id, { input, surface });
  return surface;
}

/**
 * The current derived TIN of a surface **as it currently stands** — cropped to the site boundary
 * when the crop is on, the full surveyed ground otherwise.
 *
 * Fewer than 3 distinct points yields an EMPTY surface (no triangles) — never null, so consumers
 * can read `bounds` / `triangles.length` without a null dance. A crop that intersects nothing
 * yields an empty surface too, and that is honest: the boundary and the survey do not overlap.
 */
export function getTopoSurface(id: TopoSurfaceId = 'existing'): TinSurface {
  const source = getTopoSurfaceFull(id);
  const ring = getActiveCropRing();
  if (!ring) return source;

  const memo = cropMemos.get(id);
  if (memo && memo.source === source && memo.ring === ring) return memo.surface;

  const surface = clipTinToBoundary(source, ring.vertices);
  cropMemos.set(id, { source, ring, surface });
  return surface;
}

/** True when the definition triangulates into an actual surface (≥ 1 triangle). */
export function hasTopoSurface(id: TopoSurfaceId = 'existing'): boolean {
  return getTopoSurface(id).triangles.length > 0;
}

/** Drop both memo floors (tests / teardown). The next `getTopoSurface()` rebuilds from the store. */
export function invalidateTopoSurface(): void {
  buildMemos.clear();
  cropMemos.clear();
}
