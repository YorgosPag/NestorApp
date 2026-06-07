/**
 * ADR-363 — Wall Tool region/perimeter click handlers (extracted from
 * `useWallTool.ts` for N.7.1 file-size compliance). Owns the in-region
 * (Phase 1K) click-to-pick / click-inside path, the «Τοίχος από περίγραμμα»
 * click-inside path, the shared world-unit tolerance, and the accumulated-pick
 * id reader. Behaviour mirrors the inlined callbacks exactly — same SSoT
 * analysers, same `stateRef` coherence writes, same dependency arrays.
 *
 * @see ./useWallTool.ts
 * @see ../../bim/walls/wall-in-region.ts (in-region rect detection SSoT)
 * @see ../../bim/walls/perimeter-from-faces.ts (perimeter analyser SSoT)
 */

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import {
  extractLineSegments,
  pickSegmentAt,
  findRectanglesFromSegments,
  findEnclosingRectangle,
  type RegionLineSeg,
} from '../../bim/walls/wall-in-region';
import {
  getCachedRegionPerimeters,
  pickSmallestContainingPerimeter,
  isPerimeterOversized,
  perimeterExtentMm,
  findOpenChainLineIdsNear,
} from '../../bim/walls/perimeter-from-faces';
import { resolveRegionLoopTolWorld } from '../../bim/walls/region-tolerance';
import { REGION_PERIMETER_LIMITS } from '../../config/tolerance-config';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { EventBus } from '../../systems/events/EventBus';
import type { WallToolState, UseWallToolOptions } from './wall-tool-types';
import type { WallCommitApi } from './use-wall-commit';

export interface UseWallRegionClicksArgs {
  readonly stateRef: MutableRefObject<WallToolState>;
  readonly setState: Dispatch<SetStateAction<WallToolState>>;
  readonly getSceneEntities?: UseWallToolOptions['getSceneEntities'];
  readonly getSceneUnits?: () => SceneUnits;
  readonly commitInRegionRects: WallCommitApi['commitInRegionRects'];
  readonly commitPerimeterFaces: WallCommitApi['commitPerimeterFaces'];
}

export interface UseWallRegionClicksApi {
  /** World-unit merge/hit-test tolerance (scene-units-agnostic). */
  regionTol(): number;
  /** In-region click: hit a line → accumulate (commit when 4 close a rect); miss → fill enclosing rect. */
  onRegionClick(s: WallToolState, point: Readonly<Point2D>): boolean;
  /** «Τοίχος από περίγραμμα» click-inside → build the perimeter(s) leg walls. */
  onPerimeterClick(s: WallToolState, point: Readonly<Point2D>): boolean;
  /** Deduped ids of the accumulated in-region picks (selection highlight). */
  getRegionPickIds(): string[];
}

/** Same physical segment already picked? (id + endpoints, polyline-edge aware). */
function sameSeg(a: RegionLineSeg, b: RegionLineSeg): boolean {
  return (
    a.id === b.id &&
    Math.abs(a.start.x - b.start.x) < 1e-6 &&
    Math.abs(a.start.y - b.start.y) < 1e-6 &&
    Math.abs(a.end.x - b.end.x) < 1e-6 &&
    Math.abs(a.end.y - b.end.y) < 1e-6
  );
}

export function useWallRegionClicks(args: UseWallRegionClicksArgs): UseWallRegionClicksApi {
  const { stateRef, setState, getSceneEntities, getSceneUnits, commitInRegionRects, commitPerimeterFaces } =
    args;

  // ADR-419 Layer 2 — region-detection tolerance (world units) ΜΕ gap-closure floor,
  // κοινό SSoT με το column path (αντικαθιστά το διπλό SNAP_DEFAULT/scale callback).
  const regionTol = useCallback(
    (): number => resolveRegionLoopTolWorld(getSceneUnits?.() ?? 'mm'),
    [getSceneUnits],
  );

  // ADR-419 — click while in-region, gated ΑΥΣΤΗΡΑ ανά `regionMethod` (η μονή
  // «έξυπνη» εντολή έγινε 3 διακριτές):
  //   - 'box'    → ΟΧΙ commit με κλικ (μόνο μέσω drag-πλαισίου· βλ. listener).
  //   - 'lines'  → ΜΟΝΟ pick γραμμών (commit όταν 4 κλείνουν ορθογώνιο)· κλικ στο κενό αγνοείται.
  //   - 'inside' → ΜΟΝΟ fill του εσώκλειστου ορθογωνίου κάτω από τον κέρσορα.
  const onRegionClick = useCallback(
    (s: WallToolState, point: Readonly<Point2D>): boolean => {
      if (s.regionMethod === 'box') return false;
      const entities = getSceneEntities?.() ?? [];
      const segs = extractLineSegments(entities);
      const tol = regionTol();
      if (s.regionMethod === 'lines') {
        const hit = pickSegmentAt(point, segs, tol);
        if (!hit) return false; // «από 4 γραμμές» — κλικ εκτός γραμμής = no-op
        const picks = s.regionPicks.some((p) => sameSeg(p, hit))
          ? s.regionPicks
          : [...s.regionPicks, hit];
        const rects = findRectanglesFromSegments(picks, tol);
        if (rects.length > 0) {
          const ok = commitInRegionRects({ ...s, regionPicks: picks }, [rects[0]]);
          // Keep the ref coherent for getRegionPickIds() read right after the click.
          stateRef.current = { ...stateRef.current, regionPicks: [] };
          return ok;
        }
        const next = { ...s, regionPicks: picks, error: null };
        stateRef.current = next;
        setState(next);
        return true;
      }
      // 'inside' — μόνο το εσώκλειστο (μικρότερο) ορθογώνιο (αγνοεί τα picks γραμμών).
      const rect = findEnclosingRectangle(segs, point, tol);
      if (rect) {
        // ADR-419 Layer 4 — γιγάντιο ορθογώνιο (εξωτερικό περίγραμμα) → warning.
        const scale = mmToSceneUnits(getSceneUnits?.() ?? 'mm');
        if (rect.shortSide / scale > REGION_PERIMETER_LIMITS.MAX_MEMBER_THICKNESS_MM) {
          EventBus.emit('bim:region-perimeter-rejected', {
            reason: 'oversized',
            widthM: rect.longSide / scale / 1000,
            depthM: rect.shortSide / scale / 1000,
          });
          stateRef.current = { ...stateRef.current, regionPicks: [] };
          return true;
        }
        const ok = commitInRegionRects(s, [rect]);
        stateRef.current = { ...stateRef.current, regionPicks: [] };
        return ok;
      }
      // ADR-419 Layer 5 — δεν έκλεισε ορθογώνιο κοντά αλλά υπάρχουν ανοιχτές γραμμές.
      const openIds = findOpenChainLineIdsNear(point, entities, tol);
      if (openIds.length > 0) {
        EventBus.emit('bim:region-perimeter-rejected', { reason: 'no-closed-loop' });
        EventBus.emit('dxf.highlightByIds', { mode: 'select', ids: openIds });
        return true;
      }
      return false;
    },
    [getSceneEntities, getSceneUnits, regionTol, commitInRegionRects, stateRef, setState],
  );

  // ADR-363 «Τοίχος από περίγραμμα» — click inside a closed perimeter under the
  // cursor → build its leg walls (box-select is the primary gesture; this is the
  // single-click convenience that mirrors in-region's click-inside path).
  const onPerimeterClick = useCallback(
    (s: WallToolState, point: Readonly<Point2D>): boolean => {
      const entities = getSceneEntities?.() ?? [];
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      const tol = resolveRegionLoopTolWorld(sceneUnits);
      const scale = mmToSceneUnits(sceneUnits);
      // Cached (SSoT) — κοινό με hover· μηδέν O(n²) recompute στο κλικ.
      const perimeters = getCachedRegionPerimeters(entities, tol);
      // ADR-419 Layer 1 — μικρότερο εμπεριέχον loop (όχι όλα τα containing).
      const pick = pickSmallestContainingPerimeter(point, perimeters);
      if (!pick) {
        // Layer 5 — open-loop diagnostics.
        const openIds = findOpenChainLineIdsNear(point, entities, tol);
        if (openIds.length === 0) return false;
        EventBus.emit('bim:region-perimeter-rejected', { reason: 'no-closed-loop' });
        EventBus.emit('dxf.highlightByIds', { mode: 'select', ids: openIds });
        return true;
      }
      // Layer 4 — γιγάντιο περίγραμμα → warning, όχι garbage τοίχος.
      if (isPerimeterOversized(pick, scale)) {
        const { width, height } = perimeterExtentMm(pick, scale);
        EventBus.emit('bim:region-perimeter-rejected', {
          reason: 'oversized',
          widthM: width / 1000,
          depthM: height / 1000,
        });
        return true;
      }
      const ok = commitPerimeterFaces(s, {
        perimeters: [pick],
        rects: [...pick.rects],
        ignoredCount: pick.rects.length === 0 ? 1 : 0,
      });
      stateRef.current = { ...stateRef.current, regionPicks: [] };
      return ok;
    },
    [getSceneEntities, getSceneUnits, commitPerimeterFaces, stateRef],
  );

  // ADR-363 Phase 1K — live ids of accumulated in-region picks (selection highlight).
  const getRegionPickIds = useCallback(
    (): string[] => {
      const ids = stateRef.current.regionPicks.map((p) => p.id).filter((id): id is string => !!id);
      return [...new Set(ids)];
    },
    [],
  );

  return { regionTol, onRegionClick, onPerimeterClick, getRegionPickIds };
}
