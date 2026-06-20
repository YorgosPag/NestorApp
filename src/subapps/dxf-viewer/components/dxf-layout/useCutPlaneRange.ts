'use client';

/**
 * ADR-452 — useCutPlaneRange: reactive cut-plane slider range, scope-aware.
 *
 * The range spans the ACTUAL occupied vertical envelope of the entities in scope —
 * NOT the storey FFL band — so πέδιλα (foundations), που κρέμονται ΚΑΤΩ από το FFL
 * με αρνητικό `topElevationMm`, are reachable by the slider (Giorgio 2026-06-20:
 * «η μετακίνηση του slider δεν πιάνει τα πέδιλα» — even on the single «Θεμελίωση»
 * storey, where the old `0…storeyHeight` range could never go negative).
 *
 * - Single-floor scope (2D, or 3D «ενεργός όροφος»): FFL-relative envelope of the
 *   active floor's BIM entities (`Bim3DEntitiesStore`), seeded with the storey band
 *   `[0, storeyHeight]` (Revit per-level View Range, extended down to reach πέδιλα).
 * - «Όλοι οι όροφοι» scope (3D `floor3DScope === 'all'`): datum-relative union of
 *   every floor's envelope, read from the EXISTING multi-floor stacks
 *   (`multi-floor-3d-source` + `multi-floor-dxf-source`).
 *
 * Per-entity Z reuses the render-path SSoT `getEntityZExtents` (the same gate the
 * 2D hide path uses) — no duplicate Z math. Pure range reduction lives in
 * `./multi-floor-cut-range`. Returns `null` when nothing is in scope (slider hides).
 */

import { useMemo, useSyncExternalStore } from 'react';
import { useActiveStoreyContext } from '../../systems/levels/useActiveStoreySync';
import { useViewMode3DStore, selectIs3D, selectFloor3DScope } from '../../bim-3d/stores/ViewMode3DStore';
import { useBim3DEntitiesStore } from '../../bim-3d/stores/Bim3DEntitiesStore';
import {
  getMultiFloorStack,
  subscribeMultiFloorStack,
  type FloorStackEntry,
} from '../../bim-3d/scene/multi-floor-3d-source';
import {
  getMultiFloorDxfStack,
  subscribeMultiFloorDxfStack,
  type DxfFloorStackEntry,
} from '../../bim-3d/scene/multi-floor-dxf-source';
import { useBuildingFloorScenes } from '../../hooks/data/useBuildingFloorScenes';
import { getEntityZExtents } from '../../bim/visibility/entity-z-extents';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import { type CutPlaneRange } from './cut-plane-range';
import { computeMultiFloorCutRange, type FloorCutExtent } from './multi-floor-cut-range';

export type { CutPlaneRange } from './cut-plane-range';

/**
 * Vertical envelope (mm) of a set of entities, seeded with `[seedLo, seedHi]` and
 * extended by each entity's Z extent lifted by `fflOffset`. `getEntityZExtents`
 * returns null for raw DXF / un-gated types (they keep the seed band). The offset
 * is 0 for the FFL-relative single-floor range, or the floor's datum-relative FFL
 * for the all-floors range.
 */
/**
 * Vertical slider margin (mm) added below the lowest material so the cut can sit
 * strictly under it (the 2D hide-gate needs `cut < base`). 1 slider step (10mm).
 */
const CUT_RANGE_BOTTOM_MARGIN_MM = 10;

function entityEnvelope(
  entities: readonly DxfEntityUnion[],
  fflOffset: number,
  seedLo: number,
  seedHi: number,
): { minMm: number; maxMm: number } {
  let minMm = Math.min(seedLo, seedHi);
  let maxMm = Math.max(seedLo, seedHi);
  for (const e of entities) {
    const ext = getEntityZExtents(e);
    if (!ext) continue;
    // Foundations carry datum-relative Z (`topElevationMm` = project origin), so
    // they must NOT get the floor's FFL offset (that would double-count it, pushing
    // the range ~1 storey too deep). Everything else is floor-relative.
    const offset = e.type === 'foundation' ? 0 : fflOffset;
    const lo = offset + ext.zBottomMm;
    const hi = offset + ext.zTopMm;
    if (lo < minMm) minMm = lo;
    if (hi > maxMm) maxMm = hi;
  }
  return { minMm, maxMm };
}

/** Per-floor extent for the all-floors path (datum-relative, storey band seeded). */
function resolveFloorExtent(
  bim: FloorStackEntry,
  dxfNonEmpty: boolean,
  fallbackStoreyHeightMm: number,
): FloorCutExtent {
  const ffl = bim.floorElevationMm;
  const ceiling =
    typeof bim.nextFloorElevationMm === 'number' && Number.isFinite(bim.nextFloorElevationMm)
      ? bim.nextFloorElevationMm
      : ffl + fallbackStoreyHeightMm;

  const entities = Object.values(bim.entities).flat() as DxfEntityUnion[];
  const hasEntities = entities.length > 0 || dxfNonEmpty;
  if (!hasEntities) return { hasEntities: false, minMm: 0, maxMm: 0 };

  const env = entityEnvelope(entities, ffl, ffl, ceiling);
  return { hasEntities: true, minMm: env.minMm, maxMm: env.maxMm };
}

/** Merge the BIM + DXF multi-floor stacks into per-floor extents keyed by levelId. */
function buildFloorCutExtents(
  bim: readonly FloorStackEntry[],
  dxf: readonly DxfFloorStackEntry[],
  fallbackStoreyHeightMm: number,
): FloorCutExtent[] {
  const dxfNonEmptyByLevel = new Map<string, boolean>();
  for (const d of dxf) {
    dxfNonEmptyByLevel.set(d.levelId, (d.scene.entities?.length ?? 0) > 0);
  }

  const seenLevels = new Set<string>();
  const out: FloorCutExtent[] = [];
  for (const b of bim) {
    seenLevels.add(b.levelId);
    out.push(resolveFloorExtent(b, dxfNonEmptyByLevel.get(b.levelId) ?? false, fallbackStoreyHeightMm));
  }
  for (const d of dxf) {
    if (seenLevels.has(d.levelId)) continue;
    if ((d.scene.entities?.length ?? 0) === 0) continue;
    out.push({ hasEntities: true, minMm: d.floorElevationMm, maxMm: d.floorElevationMm + fallbackStoreyHeightMm });
  }
  return out;
}

/** Reactive snapshot of the active floor's BIM entities (single-floor scope). */
function useActiveFloorEntities(): readonly DxfEntityUnion[] {
  const walls = useBim3DEntitiesStore((s) => s.walls);
  const columns = useBim3DEntitiesStore((s) => s.columns);
  const beams = useBim3DEntitiesStore((s) => s.beams);
  const foundations = useBim3DEntitiesStore((s) => s.foundations);
  const slabs = useBim3DEntitiesStore((s) => s.slabs);
  const slabOpenings = useBim3DEntitiesStore((s) => s.slabOpenings);
  const openings = useBim3DEntitiesStore((s) => s.openings);
  const stairs = useBim3DEntitiesStore((s) => s.stairs);
  return useMemo(
    () => [...walls, ...columns, ...beams, ...foundations, ...slabs, ...slabOpenings, ...openings, ...stairs] as DxfEntityUnion[],
    [walls, columns, beams, foundations, slabs, slabOpenings, openings, stairs],
  );
}

/** Reactive hook: cut-plane range (single storey, 2D underlay stack, or 3D stack). */
export function useCutPlaneRange(): CutPlaneRange | null {
  const storey = useActiveStoreyContext();
  const is3D = useViewMode3DStore(selectIs3D);
  const scope = useViewMode3DStore(selectFloor3DScope);
  const all = scope === 'all';
  const all3D = is3D && all;
  const all2D = !is3D && all;

  // 3D «all»: datum-relative stacked envelope from the 3D multi-floor source SSoTs.
  const bimStack = useSyncExternalStore(subscribeMultiFloorStack, getMultiFloorStack, getMultiFloorStack);
  const dxfStack = useSyncExternalStore(subscribeMultiFloorDxfStack, getMultiFloorDxfStack, getMultiFloorDxfStack);
  // Active floor's BIM entities (single + 2D-all). Reused from the 3D entities store.
  const activeEntities = useActiveFloorEntities();
  // 2D «all»: the OTHER building floors' raw models — SAME canonical source the 2D
  // underlay (`FloorUnderlayOverlay`) uses, so occupancy stays in lock-step. Empty
  // ([]) unless 2D-all, so no Firestore cost in other scopes.
  const underlayFloors = useBuildingFloorScenes(all2D);

  const storeyHeightMm = storey?.storeyHeightMm ?? null;

  return useMemo(() => {
    // 3D «all»: stacked building envelope (datum-relative, per-floor FFL offset).
    if (all3D) {
      return computeMultiFloorCutRange(
        buildFloorCutExtents(bimStack, dxfStack, storeyHeightMm ?? 0),
        CUT_RANGE_BOTTOM_MARGIN_MM,
      );
    }
    if (storeyHeightMm == null) return null;
    // 2D «all»: a plan κάτοψη — every floor shares the plan plane (NO stacking
    // offset), so the range is the floor-relative envelope of the active floor +
    // every other floor's entities (πέδιλα below 0 pull the min down).
    if (all2D) {
      const others = underlayFloors.flatMap((f) => f.model.entities as DxfEntityUnion[]);
      const env = entityEnvelope([...activeEntities, ...others], 0, 0, storeyHeightMm);
      return computeMultiFloorCutRange(
        [{ hasEntities: true, minMm: env.minMm, maxMm: env.maxMm }],
        CUT_RANGE_BOTTOM_MARGIN_MM,
      );
    }
    // Single floor (2D or 3D «ενεργός όροφος»): FFL-relative storey band [0, storeyHeight]
    // extended down/up by the active floor's real entity extents (reaches πέδιλα below 0).
    const env = entityEnvelope(activeEntities, 0, 0, storeyHeightMm);
    return computeMultiFloorCutRange(
      [{ hasEntities: true, minMm: env.minMm, maxMm: env.maxMm }],
      CUT_RANGE_BOTTOM_MARGIN_MM,
    );
  }, [all3D, all2D, bimStack, dxfStack, activeEntities, underlayFloors, storeyHeightMm]);
}
