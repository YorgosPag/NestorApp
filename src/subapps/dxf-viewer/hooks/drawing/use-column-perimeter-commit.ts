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
  type PerimeterColumnClassification,
} from '../../bim/columns/column-from-faces';
import { perimeterFacesToRects } from '../../bim/walls/perimeter-from-faces';
import {
  requestColumnPerimeterConfirm,
  requestColumnIsColumnWarn,
} from '../../bim/columns/column-perimeter-confirm-store';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import { EventBus } from '../../systems/events/EventBus';

export interface ColumnPerimeterCommitParams {
  readonly stateRef: MutableRefObject<ColumnToolState>;
  readonly onColumnCreatedRef: MutableRefObject<((entity: ColumnEntity) => void) | undefined>;
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
  const { stateRef, onColumnCreatedRef, getSceneEntitiesRef, getSceneUnitsRef, currentLevelId } =
    params;

  // Live scene-units-agnostic hit-test tolerance (world units), ίδιος κανόνας
  // SNAP_DEFAULT/scale με το «Τοίχος από περίγραμμα».
  const regionTol = useCallback(
    (): number => TOLERANCE_CONFIG.SNAP_DEFAULT / getImmediateTransform().scale,
    [],
  );

  // ── outer-perimeter (Φ3 «Τοιχίο από περίγραμμα», ΜΕ ένωση) ────────────────
  const commitPerimeterColumns = useCallback(
    (built: { columns: ColumnEntity[]; ignored: number }): boolean => {
      for (const column of built.columns) onColumnCreatedRef.current?.(column);
      EventBus.emit('bim:columns-from-perimeter', {
        built: built.columns.length,
        ignored: built.ignored,
      });
      return built.columns.length > 0;
    },
    [onColumnCreatedRef],
  );

  const onPerimeterClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      const entities = getSceneEntitiesRef.current?.() ?? [];
      const { perimeters } = perimeterFacesToRects(entities, regionTol());
      const hit = perimeters.filter((p) => isPointInPolygon(point as Point2D, [...p.polygon]));
      if (hit.length === 0) return false;
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';

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
    [regionTol, currentLevelId, commitPerimeterColumns, getSceneEntitiesRef, getSceneUnitsRef],
  );

  // ── discrete-perimeter (Φ3c «Κολώνα από περίγραμμα», ΧΩΡΙΣ ένωση) ──────────
  // Append per-entity μέσω onColumnCreated (ίδια granularity) + breakdown event.
  const appendDiscreteColumns = useCallback(
    (built: PerimeterColumnClassification): void => {
      for (const column of built.columns) onColumnCreatedRef.current?.(column);
      EventBus.emit('bim:columns-discrete-from-perimeter', {
        columns: built.columnCount,
        walls: built.wallCount,
        ignored: built.ignored,
      });
    },
    [onColumnCreatedRef],
  );

  // Όταν εντοπιστεί ≥1 τοιχίο → ενημερωτικό confirm (Giorgio: ΠΟΤΕ αυθαίρετη
  // ισοπέδωση)· [Άκυρο] = όλα ή τίποτα. Όλα κολώνες → δημιουργία κατευθείαν.
  const commitDiscretePerimeterColumns = useCallback(
    async (built: PerimeterColumnClassification): Promise<boolean> => {
      if (built.columns.length === 0) {
        EventBus.emit('bim:columns-discrete-from-perimeter', {
          columns: 0,
          walls: 0,
          ignored: built.ignored,
        });
        return false;
      }
      if (built.wallCount > 0) {
        const action = await requestColumnPerimeterConfirm({
          walls: built.wallCount,
          columns: built.columnCount,
        });
        if (action === 'cancel') return false; // όλα ή τίποτα
      }
      appendDiscreteColumns(built);
      return true;
    },
    [appendDiscreteColumns],
  );

  const onDiscretePerimeterClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      const entities = getSceneEntitiesRef.current?.() ?? [];
      const { perimeters } = perimeterFacesToRects(entities, regionTol(), {
        unionTouching: false,
      });
      const hit = perimeters.filter((p) => isPointInPolygon(point as Point2D, [...p.polygon]));
      if (hit.length === 0) return false;
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      void commitDiscretePerimeterColumns(
        classifyColumnsFromPerimeters(hit, currentLevelId, sceneUnits),
      );
      return true;
    },
    [
      regionTol,
      currentLevelId,
      commitDiscretePerimeterColumns,
      getSceneEntitiesRef,
      getSceneUnitsRef,
    ],
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
        if (s.placementMode === 'discrete-perimeter') {
          void commitDiscretePerimeterColumns(
            classifyPerimeterFacesToColumns(selected, regionTol(), currentLevelId, sceneUnits),
          );
        } else {
          // EC2 §9.6.1 guard: extract perimeters first so we can check aspect ratios
          // before committing. perimeterFacesToColumns does the same call internally.
          const { perimeters } = perimeterFacesToRects(selected, regionTol(), {
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
      regionTol,
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
