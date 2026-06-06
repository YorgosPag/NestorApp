/**
 * ADR-419 §column-in-region — «Κολώνα σε περιοχή (4 γραμμές)» click + box-select
 * handlers για το column tool. Mirror 1:1 του `use-wall-region-clicks.ts` +
 * `useWallToolRegionBoxSelectListener`, αλλά χτίζει `ColumnEntity` αντί `WallEntity`.
 *
 * Επαναχρησιμοποιεί ΑΚΡΙΒΩΣ την ΙΔΙΑ region-detection SSoT (`extractLineSegments`
 * + `pickSegmentAt` + `findRectanglesFromSegments` + `findEnclosingRectangle` από
 * `bim/walls/wall-in-region.ts`) — η μόνη διαφορά είναι ο builder
 * `DetectedRectangle → ColumnEntity` (`buildColumnFillingRect`). Έτσι ο χρήστης
 * φτιάχνει κολώνες με τον ΙΔΙΟ τρόπο που φτιάχνει τοίχους σε περιοχή.
 *
 * Τρεις τρόποι (ίδιοι με τον τοίχο):
 *   - 4 κλικ σε γραμμές → accumulate· commit όταν 4 κλείνουν ορθογώνιο.
 *   - 1 κλικ μέσα σε περιοχή → fill το εσώκλειστο ορθογώνιο.
 *   - drag box-select → ΟΛΑ τα εσώκλειστα ορθογώνια.
 *
 * @see ./use-wall-region-clicks.ts (wall mirror)
 * @see ../../bim/columns/column-from-faces.ts (buildColumnFillingRect SSoT adapter)
 * @see ../../bim/walls/wall-in-region.ts (region detection SSoT)
 */

import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { ColumnEntity } from '../../bim/types/column-types';
import {
  extractLineSegments,
  pickSegmentAt,
  findRectanglesFromSegments,
  findEnclosingRectangle,
  type DetectedRectangle,
  type RegionLineSeg,
} from '../../bim/walls/wall-in-region';
import { buildColumnFillingRect } from '../../bim/columns/column-from-faces';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import { EventBus } from '../../systems/events/EventBus';
import type { SceneUnits } from './column-completion';
import type { ColumnToolState } from './useColumnTool';

export interface ColumnRegionClicksParams {
  readonly stateRef: MutableRefObject<ColumnToolState>;
  readonly setState: Dispatch<SetStateAction<ColumnToolState>>;
  readonly onColumnCreatedRef: MutableRefObject<((entity: ColumnEntity) => void) | undefined>;
  readonly getSceneEntitiesRef: MutableRefObject<(() => readonly Entity[]) | undefined>;
  readonly getSceneUnitsRef: MutableRefObject<(() => SceneUnits) | undefined>;
  readonly currentLevelId: string;
}

export interface ColumnRegionClicksApi {
  /** In-region click: hit a line → accumulate (commit when 4 close a rect); miss → fill enclosing rect. */
  onRegionClick(s: ColumnToolState, point: Readonly<Point2D>): boolean;
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

export function useColumnRegionClicks(params: ColumnRegionClicksParams): ColumnRegionClicksApi {
  const { stateRef, setState, onColumnCreatedRef, getSceneEntitiesRef, getSceneUnitsRef, currentLevelId } =
    params;

  // Live scene-units-agnostic merge / hit-test tolerance (world units), ίδιος
  // κανόνας SNAP_DEFAULT/scale με το «Τοίχος σε περιοχή».
  const regionTol = useCallback(
    (): number => TOLERANCE_CONFIG.SNAP_DEFAULT / getImmediateTransform().scale,
    [],
  );

  // One filling column per detected rectangle; returns true αν χτίστηκε ≥1.
  const commitInRegionRects = useCallback(
    (rects: readonly DetectedRectangle[]): boolean => {
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      let built = 0;
      for (const rect of rects) {
        const entity = buildColumnFillingRect(rect, currentLevelId, sceneUnits);
        if (entity) {
          onColumnCreatedRef.current?.(entity);
          built++;
        }
      }
      return built > 0;
    },
    [currentLevelId, onColumnCreatedRef, getSceneUnitsRef],
  );

  // Click while in-region: hit a line → accumulate (commit when 4 close a rect);
  // miss → treat the click as "inside a region" and fill the enclosing rectangle.
  const onRegionClick = useCallback(
    (s: ColumnToolState, point: Readonly<Point2D>): boolean => {
      const segs = extractLineSegments(getSceneEntitiesRef.current?.() ?? []);
      const tol = regionTol();
      const hit = pickSegmentAt(point, segs, tol);
      if (hit) {
        const picks = s.regionPicks.some((p) => sameSeg(p, hit))
          ? s.regionPicks
          : [...s.regionPicks, hit];
        const rects = findRectanglesFromSegments(picks, tol);
        if (rects.length > 0) {
          const ok = commitInRegionRects([rects[0]]);
          // Keep the ref coherent for getRegionPickIds() read right after the click.
          stateRef.current = { ...stateRef.current, regionPicks: [] };
          setState((prev) => ({ ...prev, regionPicks: [], error: null }));
          return ok;
        }
        const next = { ...s, regionPicks: picks, error: null };
        stateRef.current = next;
        setState(next);
        return true;
      }
      const rect = findEnclosingRectangle(segs, point, tol);
      if (rect) {
        const ok = commitInRegionRects([rect]);
        stateRef.current = { ...stateRef.current, regionPicks: [] };
        setState((prev) => ({ ...prev, regionPicks: [], error: null }));
        return ok;
      }
      return false;
    },
    [stateRef, setState, regionTol, commitInRegionRects, getSceneEntitiesRef],
  );

  // Live ids of accumulated in-region picks (selection highlight).
  const getRegionPickIds = useCallback((): string[] => {
    const ids = stateRef.current.regionPicks.map((p) => p.id).filter((id): id is string => !!id);
    return [...new Set(ids)];
  }, [stateRef]);

  // Box-select listener (reuse κοινό 'bim:wall-region-box-select'). Inert εκτός
  // in-region mode. Mirror του `useWallToolRegionBoxSelectListener`.
  useEffect(
    () =>
      EventBus.on('bim:wall-region-box-select', ({ entityIds }) => {
        const s = stateRef.current;
        if (s.placementMode !== 'in-region' || s.phase === 'idle') return;
        const idSet = new Set(entityIds);
        const segs = extractLineSegments(
          (getSceneEntitiesRef.current?.() ?? []).filter((e) => idSet.has(e.id)),
        );
        const rects = findRectanglesFromSegments(segs, regionTol());
        if (rects.length > 0) {
          commitInRegionRects(rects);
          stateRef.current = { ...stateRef.current, regionPicks: [] };
          setState((prev) => ({ ...prev, regionPicks: [] }));
        }
      }),
    [stateRef, setState, getSceneEntitiesRef, regionTol, commitInRegionRects],
  );

  return { onRegionClick, getRegionPickIds };
}
