/**
 * ADR-419 — Floor-Finish Tool React Hook (thin binding over the shared area-tool SSoT).
 *
 * The N-click closed-boundary FSM + face-snap + Enter/lifecycle + live-preview
 * scaffolding all live in {@link usePolygonAreaTool} (Cluster #17 SSoT, ADR-626) →
 * {@link usePolygonSketchChain} (ADR-363). Here we bind only the Floor-Finish domain:
 * the preview store, the build+commit closure, and the i18n status keys.
 *
 * Face-snap parity (ADR-626): boundary vertices now flush to wall/column faces —
 * the same Revit «Floor by boundary» behaviour Roof/Slab already had.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-419-floor-finish-per-room.md
 * @see hooks/drawing/use-polygon-area-tool — shared closed-area drawing-tool SSoT (ADR-626)
 */

import type { Entity } from '../../types/entities';
import type { FloorFinishEntity } from '../../bim/types/floor-finish-types';
import {
  buildFloorFinishEntity,
  buildDefaultFloorFinishParams,
  type FloorFinishParamOverrides,
  type SceneUnits,
} from './floor-finish-completion';
import { floorFinishPreviewStore } from '../../bim/floor-finishes/floor-finish-preview-store';
import {
  usePolygonAreaTool,
  type PolygonAreaToolResult,
  type PolygonAreaToolState,
} from './use-polygon-area-tool';

/** World-units snap tolerance — caller scales by view zoom αν χρειαστεί. */
export const FLOOR_FINISH_AUTO_CLOSE_TOLERANCE_DEFAULT = 50;

export interface UseFloorFinishToolOptions {
  /** Callback fired μετά από επιτυχές build + commit. */
  readonly onFloorFinishCreated?: (entity: FloorFinishEntity) => void;
  /** Layer ID στο οποίο γράφεται η νέα επικάλυψη δαπέδου. */
  readonly currentLevelId?: string;
  /** Optional resolver για auto-close tolerance σε world units (default 50). */
  readonly getAutoCloseTolerance?: () => number;
  /** Returns the active scene's coordinate units for correct calculations. */
  readonly getSceneUnits?: () => SceneUnits;
  /** ADR-626 — live scene entities για τον face-snap κορυφών (flush σε παρειά μέλους). */
  readonly getSceneEntities?: () => readonly Entity[];
}

export type FloorFinishToolState = PolygonAreaToolState<FloorFinishParamOverrides>;
export type UseFloorFinishToolResult = PolygonAreaToolResult<FloorFinishParamOverrides>;

export function useFloorFinishTool(options: UseFloorFinishToolOptions = {}): UseFloorFinishToolResult {
  return usePolygonAreaTool<FloorFinishParamOverrides, FloorFinishEntity>({
    previewStore: floorFinishPreviewStore,
    commitEntity: (vertices, overrides, sceneUnits, levelId) =>
      buildFloorFinishEntity(buildDefaultFloorFinishParams(vertices, overrides, sceneUnits), levelId),
    statusKeys: {
      first: 'tools.floorFinish.statusFirstVertex',
      next: 'tools.floorFinish.statusNextVertex',
    },
    onCreated: options.onFloorFinishCreated,
    currentLevelId: options.currentLevelId,
    getAutoCloseTolerance: options.getAutoCloseTolerance,
    getSceneUnits: options.getSceneUnits,
    getSceneEntities: options.getSceneEntities,
  });
}
