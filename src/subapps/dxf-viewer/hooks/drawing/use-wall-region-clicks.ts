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
  pickRegionPerimeterAt,
  isPerimeterOversized,
  perimeterExtentMm,
  findOpenChainLineIdsNear,
  findOpenChainEndpointsNear,
} from '../../bim/walls/perimeter-from-faces';
import {
  setRegionGapMarkers,
  clearRegionGapMarkers,
} from '../../systems/region-preview/RegionGapMarkersStore';
import { resolveRegionLoopTolWorld } from '../../bim/walls/region-tolerance';
import { REGION_PERIMETER_LIMITS } from '../../config/tolerance-config';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { EventBus } from '../../systems/events/EventBus';
import type { Entity } from '../../types/entities';
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

/**
 * Αποτέλεσμα της «κλικ μέσα σε εσώκλειστο ορθογώνιο» ανίχνευσης:
 *   - `filled`    → βρέθηκε έγκυρο (μη-oversized) ορθογώνιο ΚΑΙ γεμίστηκε με τοίχο.
 *   - `oversized` → βρέθηκε ορθογώνιο αλλά είναι πολύ μεγάλο (εξωτερικό περίγραμμα)·
 *                   φέρει διαστάσεις για warning· ΔΕΝ δημιουργήθηκε τοίχος.
 *   - `none`      → δεν υπάρχει εσώκλειστο ορθογώνιο κάτω από το σημείο.
 */
export type EnclosingRectFillResult =
  | { readonly kind: 'filled' }
  | { readonly kind: 'oversized'; readonly widthM: number; readonly depthM: number }
  | { readonly kind: 'none' };

export interface UseWallRegionClicksApi {
  /** World-unit merge/hit-test tolerance (scene-units-agnostic). */
  regionTol(): number;
  /**
   * ADR-419 §wall-inside SSoT — εντοπίζει το εσώκλειστο (μικρότερο) ορθογώνιο DXF
   * κάτω από το σημείο και, αν είναι έγκυρο, γεμίζει έναν τοίχο μέσα του (ίδιο
   * detection + commit με το `wall-region-inside`). Side-effect-free ως προς
   * EventBus — ο caller αποφασίζει τι κάνει με `oversized`/`none` (ο σκέτος
   * «Τοίχος» πέφτει σε freehand, το region tool δείχνει warning/diagnostics).
   */
  fillEnclosingRectAt(s: WallToolState, point: Readonly<Point2D>): EnclosingRectFillResult;
  /** In-region click: hit a line → accumulate (commit when 4 close a rect); miss → fill enclosing rect. */
  onRegionClick(s: WallToolState, point: Readonly<Point2D>): boolean;
  /** «Τοίχος από περίγραμμα» click-inside → build the perimeter(s) leg walls. */
  onPerimeterClick(s: WallToolState, point: Readonly<Point2D>): boolean;
  /** Deduped ids of the accumulated in-region picks (selection highlight). */
  getRegionPickIds(): string[];
}

/**
 * ADR-419 Layer 5/5b/gap-close — κοινό feedback όταν ο βρόχος ΔΕΝ κλείνει: warning +
 * line-highlight + κόκκινοι κύκλοι στα ανοιχτά άκρα. Αν το κενό είναι ΑΚΡΙΒΩΣ 1 (2 άκρα),
 * emit-άρει `bim:region-gap-detected` → πρόταση «Να κλείσω το κενό;». Επιστρέφει `true`
 * αν υπήρχαν ανοιχτές γραμμές (= handled), αλλιώς `false` (κενός χώρος).
 */
function emitOpenLoopFeedback(
  point: Readonly<Point2D>, entities: readonly Entity[], tol: number,
): boolean {
  const openIds = findOpenChainLineIdsNear(point, entities, tol);
  if (openIds.length === 0) return false;
  EventBus.emit('bim:region-perimeter-rejected', { reason: 'no-closed-loop' });
  EventBus.emit('dxf.highlightByIds', { mode: 'select', ids: openIds });
  const endpoints = findOpenChainEndpointsNear(point, entities, tol);
  setRegionGapMarkers(endpoints);
  // ΑΚΡΙΒΩΣ ένα κενό (2 ελεύθερα άκρα) → πρόταση κλεισίματος· η γραμμή-ένωσης κληρονομεί
  // το layer της ανοιχτής παρειάς (`use-region-gap-close` προσθέτει τη γραμμή στο «Ναι»).
  if (endpoints.length === 2) {
    const layerId = entities.find((e) => e.id === openIds[0])?.layerId ?? '0';
    EventBus.emit('bim:region-gap-detected', { start: endpoints[0], end: endpoints[1], layerId });
  }
  return true;
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

  // ADR-419 §wall-inside SSoT — «κλικ μέσα σε εσώκλειστο ορθογώνιο» → ένας τοίχος
  // που το γεμίζει. Κοινό detection+commit για (α) το `wall-region-inside` και (β)
  // τον σκέτο «Τοίχο» (Giorgio 2026-07-01 «Β»: hover DXF παραλληλόγραμμο → κλικ
  // γεμίζει). Καθαρό από EventBus ώστε ο σκέτος τοίχος να μπορεί να πέσει σιωπηλά
  // σε freehand όταν δεν υπάρχει/είναι oversized το ορθογώνιο.
  const fillEnclosingRectAt = useCallback(
    (s: WallToolState, point: Readonly<Point2D>): EnclosingRectFillResult => {
      const segs = extractLineSegments(getSceneEntities?.() ?? []);
      const rect = findEnclosingRectangle(segs, point, regionTol());
      if (!rect) return { kind: 'none' };
      // ADR-419 Layer 4 — γιγάντιο ορθογώνιο (εξωτερικό περίγραμμα) → όχι garbage τοίχος.
      const scale = mmToSceneUnits(getSceneUnits?.() ?? 'mm');
      if (rect.shortSide / scale > REGION_PERIMETER_LIMITS.MAX_MEMBER_THICKNESS_MM) {
        stateRef.current = { ...stateRef.current, regionPicks: [] };
        return { kind: 'oversized', widthM: rect.longSide / scale / 1000, depthM: rect.shortSide / scale / 1000 };
      }
      const ok = commitInRegionRects(s, [rect]);
      stateRef.current = { ...stateRef.current, regionPicks: [] };
      return ok ? { kind: 'filled' } : { kind: 'none' };
    },
    [getSceneEntities, getSceneUnits, regionTol, commitInRegionRects, stateRef],
  );

  // ADR-419 — click while in-region, gated ΑΥΣΤΗΡΑ ανά `regionMethod` (η μονή
  // «έξυπνη» εντολή έγινε 3 διακριτές):
  //   - 'box'    → ΟΧΙ commit με κλικ (μόνο μέσω drag-πλαισίου· βλ. listener).
  //   - 'lines'  → ΜΟΝΟ pick γραμμών (commit όταν 4 κλείνουν ορθογώνιο)· κλικ στο κενό αγνοείται.
  //   - 'inside' → ΜΟΝΟ fill του εσώκλειστου ορθογωνίου κάτω από τον κέρσορα.
  const onRegionClick = useCallback(
    (s: WallToolState, point: Readonly<Point2D>): boolean => {
      // ADR-419 Layer 5b — κάθε νέο κλικ ξεκινά καθαρό (τα προηγούμενα gap markers φεύγουν).
      clearRegionGapMarkers();
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
      // 'inside' — ADR-419 §thickness-zones: αν το εσώκλειστο περίγραμμα σπάει σε ΠΟΛΛΑ
      // σκέλη σταθερού πλάτους (σύνθετο, π.χ. έκεντρο-Τ), δημιούργησε έναν τοίχο ΑΝΑ σκέλος
      // (preview ≡ commit — ίδιο split που δείχνει η πράσινη διακεκομμένη). Απλό ορθογώνιο
      // (1 σκέλος) → πέφτει στο υπάρχον single-rect fill (μηδέν regression).
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      const { perimeter: pick } = pickRegionPerimeterAt(point, entities, sceneUnits);
      if (pick && pick.rects.length > 1 && !isPerimeterOversized(pick, mmToSceneUnits(sceneUnits))) {
        return commitInRegionRects({ ...s, regionPicks: [] }, pick.rects);
      }
      // 'inside' — μόνο το εσώκλειστο (μικρότερο) ορθογώνιο (αγνοεί τα picks γραμμών).
      const fill = fillEnclosingRectAt(s, point);
      if (fill.kind === 'filled') return true;
      if (fill.kind === 'oversized') {
        // ADR-419 Layer 4 — γιγάντιο ορθογώνιο (εξωτερικό περίγραμμα) → warning.
        EventBus.emit('bim:region-perimeter-rejected', {
          reason: 'oversized',
          widthM: fill.widthM,
          depthM: fill.depthM,
        });
        return true;
      }
      // ADR-419 Layer 5/5b/gap-close — δεν έκλεισε loop· warning + line-highlight + κόκκινοι
      // κύκλοι στα άκρα + (αν 1 κενό) πρόταση «Να κλείσω το κενό;».
      return emitOpenLoopFeedback(point, entities, tol);
    },
    [getSceneEntities, getSceneUnits, regionTol, commitInRegionRects, stateRef, setState],
  );

  // ADR-363 «Τοίχος από περίγραμμα» — click inside a closed perimeter under the
  // cursor → build its leg walls (box-select is the primary gesture; this is the
  // single-click convenience that mirrors in-region's click-inside path).
  const onPerimeterClick = useCallback(
    (s: WallToolState, point: Readonly<Point2D>): boolean => {
      // ADR-419 Layer 5b — κάθε νέο κλικ ξεκινά καθαρό (τα προηγούμενα gap markers φεύγουν).
      clearRegionGapMarkers();
      const entities = getSceneEntities?.() ?? [];
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      const scale = mmToSceneUnits(sceneUnits);
      // ADR-419 Layer 1 SSoT — μικρότερο εμπεριέχον loop + tol (cached, κοινό click/hover).
      const { perimeter: pick, tol } = pickRegionPerimeterAt(point, entities, sceneUnits);
      if (!pick) {
        // Layer 5/5b/gap-close — open-loop diagnostics + πρόταση κλεισίματος κενού.
        return emitOpenLoopFeedback(point, entities, tol);
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

  return { regionTol, fillEnclosingRectAt, onRegionClick, onPerimeterClick, getRegionPickIds };
}
