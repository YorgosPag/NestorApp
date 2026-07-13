/**
 * ADR-650 M4 (extended M6) — the derived surfaces. SSoT for «what is the current TIN?».
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
 * Cheap by construction: no definition change → no rebuild (pointer compare, zero work).
 */

import { getTopoDefinition } from './TopoPointStore';
import { buildTin } from './tin-builder';
import type { TinSurface, TopoDefinition, TopoSurfaceId } from './topo-types';

interface Memo {
  readonly input: TopoDefinition;
  readonly surface: TinSurface;
}

const memos = new Map<TopoSurfaceId, Memo>();

/**
 * The current derived TIN of a surface. Rebuilt only when THAT surface's definition changed.
 * Fewer than 3 distinct points yields an EMPTY surface (no triangles) — never null, so
 * consumers can read `bounds` / `triangles.length` without a null dance.
 */
export function getTopoSurface(id: TopoSurfaceId = 'existing'): TinSurface {
  const input = getTopoDefinition(id);
  const memo = memos.get(id);
  if (memo && memo.input === input) return memo.surface;

  const surface = buildTin(input.points, input.breaklines);
  memos.set(id, { input, surface });
  return surface;
}

/** True when the definition triangulates into an actual surface (≥ 1 triangle). */
export function hasTopoSurface(id: TopoSurfaceId = 'existing'): boolean {
  return getTopoSurface(id).triangles.length > 0;
}

/** Drop the memo (tests / teardown). The next `getTopoSurface()` rebuilds from the store. */
export function invalidateTopoSurface(): void {
  memos.clear();
}
