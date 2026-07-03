/**
 * ADR-363 Φάση 3 / 3c — «από περίγραμμα» commit helpers για το column tool.
 *
 * Εξήχθη από `useColumnTool.ts` (N.7.1 file-size split): το box-select / click-
 * inside concern (outer-perimeter «Τοιχίο» + discrete «Κολώνα») είναι ξεχωριστή
 * ευθύνη από το freehand single-click FSM. Reuse κοινό `bim:wall-region-box-select`.
 *
 *   - outer-perimeter (Φ3)   → ΜΕ ένωση → ΕΝΑ τοιχίο (ColumnEntity) ανά περίμετρο.
 *   - discrete-perimeter (Φ3c)→ ΧΩΡΙΣ ένωση· αυτόματη ταξινόμηση κολώνα/τοιχίο ανά
 *                              αναλογία πλευρών + ενημερωτικό confirm (≥1 τοιχίο).
 *
 * @see ./useColumnTool.ts (orchestrator)
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6
 */

import { useCallback, useEffect, type MutableRefObject } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { ColumnEntity } from '../../bim/types/column-types';
import type { SceneUnits } from './column-completion';
import type { ColumnToolState } from './useColumnTool';
import {
  perimeterFacesToColumns,
  buildColumnsFromPerimeters,
  classifyPerimeterFacesToColumns,
  classifyColumnsFromPerimeters,
  perimeterColumnKind,
  perimeterAspectRatio,
  splitColumnsByIntent,
  type PerimeterColumnClassification,
} from '../../bim/columns/column-from-faces';
import { appendColumnsWithBreakdown } from '../../bim/columns/append-columns-with-breakdown';
import {
  perimeterFacesToRects,
  pickRegionPerimeterAt,
  isPerimeterOversized,
  perimeterExtentMm,
  findOpenChainLineIdsNear,
  findOpenChainEndpointsNear,
  type ClosedPerimeter,
} from '../../bim/walls/perimeter-from-faces';
import {
  setRegionGapMarkers,
  clearRegionGapMarkers,
} from '../../systems/region-preview/RegionGapMarkersStore';
import { resolveRegionLoopTolWorld } from '../../bim/walls/region-tolerance';
import {
  requestColumnDiscreteIntentConfirm,
  requestColumnIsColumnWarn,
} from '../../bim/columns/column-perimeter-confirm-store';
import { mmToSceneUnits } from '../../utils/scene-units';
import { EventBus } from '../../systems/events/EventBus';

export interface ColumnPerimeterCommitParams {
  readonly stateRef: MutableRefObject<ColumnToolState>;
  /** ADR-524 — batch appender (ΕΝΑΣ adapter για όλες τις κολόνες). */
  readonly appendColumnsRef: MutableRefObject<(entities: readonly ColumnEntity[]) => void>;
  readonly getSceneEntitiesRef: MutableRefObject<(() => readonly Entity[]) | undefined>;
  readonly getSceneUnitsRef: MutableRefObject<(() => SceneUnits) | undefined>;
  readonly currentLevelId: string;
}

export interface ColumnPerimeterCommitResult {
  /** outer-perimeter click-inside (Φ3, ΜΕ ένωση). */
  onPerimeterClick(point: Readonly<Point2D>): boolean;
  /** discrete-perimeter click-inside (Φ3c, ΧΩΡΙΣ ένωση, gated confirm). */
  onDiscretePerimeterClick(point: Readonly<Point2D>): boolean;
}

export function useColumnPerimeterCommit(
  params: ColumnPerimeterCommitParams,
): ColumnPerimeterCommitResult {
  const { stateRef, appendColumnsRef, getSceneEntitiesRef, getSceneUnitsRef, currentLevelId } =
    params;

  // ADR-419 Layer 1+2+4+5 — κοινό click-inside resolver: ανιχνεύει το ΜΙΚΡΟΤΕΡΟ
  // κλειστό περίγραμμα κάτω από το σημείο (gap-tolerant tol), και χειρίζεται τις
  // απορρίψεις (oversized / lines-don't-connect) με warning + highlight. Επιστρέφει:
  //   - 'ok'      → έγκυρο περίγραμμα προς δημιουργία.
  //   - 'handled' → εμφανίστηκε warning (γιγάντιο/ανοιχτό loop)· ο caller σταματά.
  //   - 'none'    → κενός χώρος (καμία γραμμή κοντά)· ο caller αφήνει το κλικ να περάσει.
  const resolvePerimeterPick = useCallback(
    (
      point: Readonly<Point2D>,
    ):
      | { kind: 'ok'; perimeter: ClosedPerimeter; sceneUnits: SceneUnits }
      | { kind: 'handled' }
      | { kind: 'none' } => {
      // ADR-419 Layer 5b — κάθε νέο κλικ ξεκινά καθαρό (τα προηγούμενα gap markers φεύγουν).
      clearRegionGapMarkers();
      const entities = getSceneEntitiesRef.current?.() ?? [];
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const scale = mmToSceneUnits(sceneUnits);
      // ADR-419 Layer 1 SSoT — μικρότερο εμπεριέχον loop + tol (cached, κοινό
      // με το hover preview· μηδέν O(n²) recompute στο κλικ δημιουργίας ~1.5s freeze).
      const { perimeter: pick, tol } = pickRegionPerimeterAt(point, entities, sceneUnits);
      if (!pick) {
        // Layer 5 — open-loop diagnostics: αν υπάρχουν γραμμές με ανοιχτό άκρο κοντά,
        // οι παρειές δεν ενώνονται· αλλιώς κενός χώρος (no-op).
        const openIds = findOpenChainLineIdsNear(point, entities, tol);
        if (openIds.length === 0) return { kind: 'none' };
        EventBus.emit('bim:region-perimeter-rejected', { reason: 'no-closed-loop' });
        EventBus.emit('dxf.highlightByIds', { mode: 'select', ids: openIds });
        // ADR-419 Layer 5b — κόκκινοι κύκλοι στα ανοιχτά άκρα (AutoCAD BOUNDARY): «πού» είναι το κενό.
        setRegionGapMarkers(findOpenChainEndpointsNear(point, entities, tol));
        return { kind: 'handled' };
      }
      // Layer 4 — γιγάντιο περίγραμμα (εξωτερικό του σχεδίου) → warning, όχι garbage.
      if (isPerimeterOversized(pick, scale)) {
        const { width, height } = perimeterExtentMm(pick, scale);
        EventBus.emit('bim:region-perimeter-rejected', {
          reason: 'oversized',
          widthM: width / 1000,
          depthM: height / 1000,
        });
        return { kind: 'handled' };
      }
      return { kind: 'ok', perimeter: pick, sceneUnits };
    },
    [getSceneEntitiesRef, getSceneUnitsRef],
  );

  // ── outer-perimeter (Φ3 «Τοιχίο από περίγραμμα», ΜΕ ένωση) ────────────────
  const commitPerimeterColumns = useCallback(
    (built: { columns: ColumnEntity[]; ignored: number }): boolean => {
      if (built.columns.length > 0) appendColumnsRef.current(built.columns); // ΕΝΑ batch → ΕΝΑΣ adapter
      EventBus.emit('bim:columns-from-perimeter', {
        built: built.columns.length,
        ignored: built.ignored,
      });
      return built.columns.length > 0;
    },
    [appendColumnsRef],
  );

  const onPerimeterClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      const outcome = resolvePerimeterPick(point);
      if (outcome.kind === 'none') return false;
      if (outcome.kind === 'handled') return true;
      const hit = [outcome.perimeter];
      const { sceneUnits } = outcome;

      // EC2 §9.6.1 guard: if the selected perimeter has aspect ≤ 4 it is a column,
      // not a shear wall. Warn the user before creating anything.
      const firstColumn = hit.find((p) => perimeterColumnKind(p) === 'rectangular');
      if (firstColumn) {
        const aspect = perimeterAspectRatio(firstColumn);
        void (async () => {
          const action = await requestColumnIsColumnWarn(aspect);
          if (action === 'cancel') return;
          commitPerimeterColumns(buildColumnsFromPerimeters(hit, currentLevelId, sceneUnits));
        })();
        return true;
      }

      return commitPerimeterColumns(buildColumnsFromPerimeters(hit, currentLevelId, sceneUnits));
    },
    [resolvePerimeterPick, currentLevelId, commitPerimeterColumns],
  );

  // ── discrete-perimeter (Φ3c «Πολλαπλή δημιουργία», ΧΩΡΙΣ ένωση) ────────────
  // Append έτοιμων entities + breakdown event — SSoT helper (κοινό με region/batch).
  const appendColumns = useCallback(
    (entities: readonly ColumnEntity[], ignored: number): void =>
      appendColumnsWithBreakdown(entities, (all) => appendColumnsRef.current(all), ignored),
    [appendColumnsRef],
  );

  // ADR-419 — intent-aware «Πολλαπλή δημιουργία»: δημιουργεί κατευθείαν ό,τι
  // ταιριάζει στην πρόθεση (κολώνες ή τοιχία) και ρωτά με dialog για τα υπόλοιπα
  // (μη αλλοίωση στατικών — στενόμακρο σχήμα μένει τοιχίο ακόμη κι αν πατήθηκε
  // «κολώνες»). `discreteIntent` οδηγείται από το active tool id.
  const commitDiscretePerimeterColumns = useCallback(
    async (built: PerimeterColumnClassification): Promise<boolean> => {
      const intent = stateRef.current.discreteIntent;
      const { primary, secondary } = splitColumnsByIntent(built.columns, intent);

      if (primary.length === 0 && secondary.length === 0) {
        appendColumns([], built.ignored); // SSoT — emit {0,0,ignored} χωρίς δημιουργία
        return false;
      }
      // Καθαρή πρόθεση (μόνο primary) → δημιουργία κατευθείαν, χωρίς dialog.
      if (secondary.length === 0) {
        appendColumns(primary, built.ignored);
        return true;
      }
      // Εντοπίστηκαν και «άλλου τύπου» στοιχεία → intent-aware confirm (3/2 κουμπιά).
      const action = await requestColumnDiscreteIntentConfirm({
        intent,
        primaryCount: primary.length,
        secondaryCount: secondary.length,
      });
      if (action === 'cancel') return false;
      const toCreate = action === 'create-all' ? [...primary, ...secondary] : primary;
      if (toCreate.length === 0) return false;
      appendColumns(toCreate, built.ignored);
      return true;
    },
    [stateRef, appendColumns],
  );

  const onDiscretePerimeterClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      const outcome = resolvePerimeterPick(point);
      if (outcome.kind === 'none') return false;
      if (outcome.kind === 'handled') return true;
      void commitDiscretePerimeterColumns(
        classifyColumnsFromPerimeters([outcome.perimeter], currentLevelId, outcome.sceneUnits),
      );
      return true;
    },
    [resolvePerimeterPick, currentLevelId, commitDiscretePerimeterColumns],
  );

  // Box-select listener (reuse κοινό 'bim:wall-region-box-select'). Inert εκτός
  // outer-perimeter / discrete-perimeter mode. Mirror του wall perimeter listener.
  useEffect(
    () =>
      EventBus.on('bim:wall-region-box-select', ({ entityIds }) => {
        const s = stateRef.current;
        if (s.phase === 'idle') return;
        if (s.placementMode !== 'outer-perimeter' && s.placementMode !== 'discrete-perimeter')
          return;
        const idSet = new Set(entityIds);
        const selected = (getSceneEntitiesRef.current?.() ?? []).filter((e) => idSet.has(e.id));
        const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
        const tol = resolveRegionLoopTolWorld(sceneUnits);
        if (s.placementMode === 'discrete-perimeter') {
          void commitDiscretePerimeterColumns(
            classifyPerimeterFacesToColumns(selected, tol, currentLevelId, sceneUnits),
          );
        } else {
          // EC2 §9.6.1 guard: extract perimeters first so we can check aspect ratios
          // before committing. perimeterFacesToColumns does the same call internally.
          const { perimeters } = perimeterFacesToRects(selected, tol, {
            unionTouching: true,
          });
          const firstRectangular = perimeters.find((p) => perimeterColumnKind(p) === 'rectangular');
          if (firstRectangular) {
            const aspect = perimeterAspectRatio(firstRectangular);
            void (async () => {
              const action = await requestColumnIsColumnWarn(aspect);
              if (action === 'cancel') return;
              commitPerimeterColumns(buildColumnsFromPerimeters(perimeters, currentLevelId, sceneUnits));
            })();
          } else {
            commitPerimeterColumns(buildColumnsFromPerimeters(perimeters, currentLevelId, sceneUnits));
          }
        }
      }),
    [
      currentLevelId,
      commitPerimeterColumns,
      commitDiscretePerimeterColumns,
      stateRef,
      getSceneEntitiesRef,
      getSceneUnitsRef,
    ],
  );

  return { onPerimeterClick, onDiscretePerimeterClick };
}
