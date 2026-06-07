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
import {
  buildColumnFillingRect,
  isWallColumnKind,
  splitColumnsByIntent,
} from '../../bim/columns/column-from-faces';
import { requestColumnDiscreteIntentConfirm } from '../../bim/columns/column-perimeter-confirm-store';
import { resolveRegionLoopTolWorld } from '../../bim/walls/region-tolerance';
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

  // ADR-419 Layer 2 — gap-tolerant region tolerance (world units), κοινό SSoT με
  // το «από περίγραμμα» (κλείνει μικρά κενά στις παρειές, ανεξάρτητο zoom).
  const regionTol = useCallback(
    (): number => resolveRegionLoopTolWorld(getSceneUnitsRef.current?.() ?? 'mm'),
    [getSceneUnitsRef],
  );

  // Append έτοιμων columns + breakdown event (κολώνες/τοιχία) για ενημερωτικό toast.
  const appendColumns = useCallback(
    (entities: readonly ColumnEntity[]): void => {
      let columns = 0;
      let walls = 0;
      for (const c of entities) {
        onColumnCreatedRef.current?.(c);
        if (isWallColumnKind(c.kind)) walls++;
        else columns++;
      }
      EventBus.emit('bim:columns-discrete-from-perimeter', { columns, walls, ignored: 0 });
    },
    [onColumnCreatedRef],
  );

  // ADR-419 — ένα filling column ανά ορθογώνιο, ΜΕ στατικά τίμια ταξινόμηση: aspect>4
  // → τοιχίο (shear-wall). Αφού ο χρήστης πάτησε «Κολώνα», αν εντοπιστεί τοιχίο
  // δείχνουμε το ΙΔΙΟ intent-aware confirm με το «από περίγραμμα» (Giorgio: «να
  // γίνεται τοιχίο / να ρωτάει» — όχι σιωπηλή κολώνα aspect>4). Καθαρή πρόθεση
  // (μόνο κολώνες) → δημιουργία κατευθείαν. Returns true αν χειρίστηκε το κλικ.
  const commitInRegionRects = useCallback(
    (rects: readonly DetectedRectangle[]): boolean => {
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const built: ColumnEntity[] = [];
      for (const rect of rects) {
        const entity = buildColumnFillingRect(rect, currentLevelId, sceneUnits);
        if (entity) built.push(entity);
      }
      if (built.length === 0) return false;
      const { primary, secondary } = splitColumnsByIntent(built, 'columns');
      if (secondary.length === 0) {
        appendColumns(primary);
        return true;
      }
      void (async () => {
        const action = await requestColumnDiscreteIntentConfirm({
          intent: 'columns',
          primaryCount: primary.length,
          secondaryCount: secondary.length,
        });
        if (action === 'cancel') return;
        const toCreate = action === 'create-all' ? [...primary, ...secondary] : primary;
        if (toCreate.length > 0) appendColumns(toCreate);
      })();
      return true;
    },
    [currentLevelId, getSceneUnitsRef, appendColumns],
  );

  // ADR-419 — click while in-region, gated ΑΥΣΤΗΡΑ ανά `regionMethod` (η μονή
  // «έξυπνη» εντολή έγινε 3 διακριτές):
  //   - 'box'    → ΟΧΙ commit με κλικ (μόνο μέσω drag-πλαισίου· βλ. listener).
  //   - 'lines'  → ΜΟΝΟ pick γραμμών (commit όταν 4 κλείνουν ορθογώνιο)· κλικ στο κενό αγνοείται.
  //   - 'inside' → ΜΟΝΟ fill του εσώκλειστου ορθογωνίου κάτω από τον κέρσορα.
  const onRegionClick = useCallback(
    (s: ColumnToolState, point: Readonly<Point2D>): boolean => {
      if (s.regionMethod === 'box') return false;
      const segs = extractLineSegments(getSceneEntitiesRef.current?.() ?? []);
      const tol = regionTol();
      if (s.regionMethod === 'lines') {
        const hit = pickSegmentAt(point, segs, tol);
        if (!hit) return false; // «από 4 γραμμές» — κλικ εκτός γραμμής = no-op
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
      // 'inside' — μόνο το εσώκλειστο ορθογώνιο (αγνοεί τα picks γραμμών).
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
        // ADR-419 — box-select μόνο για την «με πλαίσιο» εντολή (column-region-box).
        if (s.regionMethod !== 'box') return;
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
