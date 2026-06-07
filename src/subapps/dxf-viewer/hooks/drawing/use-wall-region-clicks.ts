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
import { perimeterFacesToRects } from '../../bim/walls/perimeter-from-faces';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import type { WallToolState, UseWallToolOptions } from './wall-tool-types';
import type { WallCommitApi } from './use-wall-commit';

export interface UseWallRegionClicksArgs {
  readonly stateRef: MutableRefObject<WallToolState>;
  readonly setState: Dispatch<SetStateAction<WallToolState>>;
  readonly getSceneEntities?: UseWallToolOptions['getSceneEntities'];
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
  const { stateRef, setState, getSceneEntities, commitInRegionRects, commitPerimeterFaces } = args;

  // Live scene-units-agnostic endpoint-merge / hit-test tolerance (world units),
  // derived from the same SNAP_DEFAULT/scale rule as the on-entity pick.
  const regionTol = useCallback(
    (): number => TOLERANCE_CONFIG.SNAP_DEFAULT / getImmediateTransform().scale,
    [],
  );

  // ADR-419 — click while in-region, gated ΑΥΣΤΗΡΑ ανά `regionMethod` (η μονή
  // «έξυπνη» εντολή έγινε 3 διακριτές):
  //   - 'box'    → ΟΧΙ commit με κλικ (μόνο μέσω drag-πλαισίου· βλ. listener).
  //   - 'lines'  → ΜΟΝΟ pick γραμμών (commit όταν 4 κλείνουν ορθογώνιο)· κλικ στο κενό αγνοείται.
  //   - 'inside' → ΜΟΝΟ fill του εσώκλειστου ορθογωνίου κάτω από τον κέρσορα.
  const onRegionClick = useCallback(
    (s: WallToolState, point: Readonly<Point2D>): boolean => {
      if (s.regionMethod === 'box') return false;
      const segs = extractLineSegments(getSceneEntities?.() ?? []);
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
      // 'inside' — μόνο το εσώκλειστο ορθογώνιο (αγνοεί τα picks γραμμών).
      const rect = findEnclosingRectangle(segs, point, tol);
      if (rect) {
        const ok = commitInRegionRects(s, [rect]);
        stateRef.current = { ...stateRef.current, regionPicks: [] };
        return ok;
      }
      return false;
    },
    [getSceneEntities, regionTol, commitInRegionRects, stateRef, setState],
  );

  // ADR-363 «Τοίχος από περίγραμμα» — click inside a closed perimeter under the
  // cursor → build its leg walls (box-select is the primary gesture; this is the
  // single-click convenience that mirrors in-region's click-inside path).
  const onPerimeterClick = useCallback(
    (s: WallToolState, point: Readonly<Point2D>): boolean => {
      const tol = regionTol();
      const result = perimeterFacesToRects(getSceneEntities?.() ?? [], tol);
      const hit = result.perimeters.filter((p) => isPointInPolygon(point as Point2D, [...p.polygon]));
      if (hit.length === 0) return false;
      const ok = commitPerimeterFaces(s, {
        perimeters: hit,
        rects: hit.flatMap((p) => [...p.rects]),
        ignoredCount: hit.filter((p) => p.rects.length === 0).length,
      });
      stateRef.current = { ...stateRef.current, regionPicks: [] };
      return ok;
    },
    [getSceneEntities, regionTol, commitPerimeterFaces],
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
