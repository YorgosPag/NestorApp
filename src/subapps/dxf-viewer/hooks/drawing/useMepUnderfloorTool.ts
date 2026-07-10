/**
 * ADR-408 Εύρος Β #3 — Underfloor (radiant floor) Tool React Hook (thin binding).
 *
 * The N-click heating-area FSM + face-snap + Enter/lifecycle + live-preview
 * scaffolding all live in {@link usePolygonAreaTool} (Cluster #17 SSoT, ADR-626) →
 * {@link usePolygonSketchChain} (ADR-363). Here we bind only the Underfloor domain:
 * the preview store, the build+commit closure, and the i18n status keys.
 *
 * Face-snap parity (ADR-626): boundary vertices now flush to wall/column faces —
 * the same behaviour Roof/Slab/Floor-Finish share.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see hooks/drawing/use-polygon-area-tool — shared closed-area drawing-tool SSoT (ADR-626)
 */

import type { Entity } from '../../types/entities';
import type { MepUnderfloorEntity } from '../../bim/types/mep-underfloor-types';
import {
  buildMepUnderfloorEntity,
  buildDefaultMepUnderfloorParams,
  type MepUnderfloorParamOverrides,
  type SceneUnits,
} from './mep-underfloor-completion';
import { mepUnderfloorPreviewStore } from '../../bim/mep-underfloor/mep-underfloor-preview-store';
import {
  usePolygonAreaTool,
  type PolygonAreaToolResult,
  type PolygonAreaToolState,
} from './use-polygon-area-tool';

/** World-units snap tolerance — caller scales by view zoom if needed. */
export const MEP_UNDERFLOOR_AUTO_CLOSE_TOLERANCE_DEFAULT = 50;

export interface UseMepUnderfloorToolOptions {
  /** Callback fired after a successful build + commit. */
  readonly onMepUnderfloorCreated?: (entity: MepUnderfloorEntity) => void;
  /** Layer ID the new heating loop is written to. */
  readonly currentLevelId?: string;
  /** Optional resolver returning the auto-close tolerance in world units (default 50). */
  readonly getAutoCloseTolerance?: () => number;
  /** Returns the active scene's coordinate units for correct calculations. */
  readonly getSceneUnits?: () => SceneUnits;
  /** ADR-626 — live scene entities for the vertex face-snap (flush to member faces). */
  readonly getSceneEntities?: () => readonly Entity[];
}

export type MepUnderfloorToolState = PolygonAreaToolState<MepUnderfloorParamOverrides>;
export type UseMepUnderfloorToolResult = PolygonAreaToolResult<MepUnderfloorParamOverrides>;

export function useMepUnderfloorTool(options: UseMepUnderfloorToolOptions = {}): UseMepUnderfloorToolResult {
  return usePolygonAreaTool<MepUnderfloorParamOverrides, MepUnderfloorEntity>({
    previewStore: mepUnderfloorPreviewStore,
    commitEntity: (vertices, overrides, sceneUnits, levelId) =>
      buildMepUnderfloorEntity(buildDefaultMepUnderfloorParams(vertices, overrides, sceneUnits), levelId),
    statusKeys: {
      first: 'tools.mepUnderfloor.statusFirstVertex',
      next: 'tools.mepUnderfloor.statusNextVertex',
    },
    onCreated: options.onMepUnderfloorCreated,
    currentLevelId: options.currentLevelId,
    getAutoCloseTolerance: options.getAutoCloseTolerance,
    getSceneUnits: options.getSceneUnits,
    getSceneEntities: options.getSceneEntities,
  });
}
