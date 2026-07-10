/**
 * ADR-417 Φ1 — Roof Tool React Hook (thin binding over the shared area-tool SSoT).
 *
 * The N-click footprint FSM + face-snap + Enter/lifecycle + live-preview scaffolding
 * all live in {@link usePolygonAreaTool} (Cluster #17 SSoT, ADR-626) →
 * {@link usePolygonSketchChain} (ADR-363, the slab/column engine Roof already
 * mirrored inline). Here we bind only the Roof domain: the preview store, the
 * build+commit closure, and the i18n status keys. Face-snap (ADR-514 Φ6) is
 * preserved by forwarding `getSceneEntities`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md §Φ1
 * @see hooks/drawing/use-polygon-area-tool — shared closed-area drawing-tool SSoT (ADR-626)
 */

import type { Entity } from '../../types/entities';
import type { RoofEntity } from '../../bim/types/roof-types';
import {
  buildRoofEntity,
  buildDefaultRoofParams,
  type RoofParamOverrides,
  type SceneUnits,
} from './roof-completion';
import { roofPreviewStore } from '../../bim/roofs/roof-preview-store';
import {
  usePolygonAreaTool,
  type PolygonAreaToolResult,
  type PolygonAreaToolState,
} from './use-polygon-area-tool';

/** World-units snap tolerance — caller scales by view zoom αν χρειαστεί. */
export const ROOF_AUTO_CLOSE_TOLERANCE_DEFAULT = 50;

export interface UseRoofToolOptions {
  /** Callback fired μετά από επιτυχές build + commit. */
  readonly onRoofCreated?: (entity: RoofEntity) => void;
  /** Layer ID στο οποίο γράφεται η νέα στέγη. */
  readonly currentLevelId?: string;
  /** Optional resolver για auto-close tolerance σε world units (default 50). */
  readonly getAutoCloseTolerance?: () => number;
  /** Returns the active scene's coordinate units for correct BOQ calculations. */
  readonly getSceneUnits?: () => SceneUnits;
  /** ADR-514 Φ6 — live scene entities για τον face-snap κορυφών (flush σε παρειά μέλους). */
  readonly getSceneEntities?: () => readonly Entity[];
}

export type RoofToolState = PolygonAreaToolState<RoofParamOverrides>;
export type UseRoofToolResult = PolygonAreaToolResult<RoofParamOverrides>;

export function useRoofTool(options: UseRoofToolOptions = {}): UseRoofToolResult {
  return usePolygonAreaTool<RoofParamOverrides, RoofEntity>({
    previewStore: roofPreviewStore,
    commitEntity: (vertices, overrides, sceneUnits, levelId) =>
      buildRoofEntity(buildDefaultRoofParams(vertices, overrides, sceneUnits), levelId),
    statusKeys: {
      first: 'tools.roof.statusFirstVertex',
      next: 'tools.roof.statusNextVertex',
    },
    onCreated: options.onRoofCreated,
    currentLevelId: options.currentLevelId,
    getAutoCloseTolerance: options.getAutoCloseTolerance,
    getSceneUnits: options.getSceneUnits,
    getSceneEntities: options.getSceneEntities,
  });
}
