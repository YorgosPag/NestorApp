/**
 * ADR-563 Φ4-Α (Auto-Dimension) — cut-line click orchestration + commit + preview.
 *
 * Bridges the pure `planCutLineChain` planner with the interactive session store,
 * the existing style/layer SSoT, and the batch-commit SSoT. Nothing new geometric
 * or persistence-wise (N.0.2):
 *   - commit  → `buildAutoDimensionEntities` + `addDimensionsToScene` (1 undoable
 *               batch, exactly like the dialog-driven auto-dimension flow).
 *   - preview → maps the same planner output to `GhostFaceDimension[]` so the RAF
 *               overlay reuses `drawGhostFaceDimensions` (cyan ghost chain).
 *
 * @see auto-dimension-cutline-planner.ts — the pure chain planner.
 * @see run-auto-dimension-flow.ts        — the dialog-driven (non-interactive) sibling.
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { SceneModel } from '../../../types/scene';
import type { SceneAppendAccessor } from '../../../bim/scene/append-entity-to-scene';
import { addDimensionsToScene } from '../../../bim/scene/add-dimensions-to-scene';
import { getLayer } from '../../../stores/LayerStore';
import { DXF_DEFAULT_LAYER } from '../../../config/layer-config';
import { resolveSceneUnits } from '../../../utils/scene-units';
import type {
  GhostFaceDimension,
  GhostFaceDimensionsMeta,
} from '../../../bim/framing/ghost-face-dim-references';
import { getDimStyleRegistry } from '../dim-style-registry';
import { planCutLineChain } from './auto-dimension-cutline-planner';
import { buildAutoDimensionEntities } from './auto-dimension-entity-factory';
import {
  getCutlineSession,
  setCutlineStart,
  setCutlineEnd,
  rearmCutline,
} from './auto-dimension-cutline-store';
import type { AutoDimensionOptions } from './auto-dimension-types';

/** Active-level scene for the accessor, or null when there is none. */
function activeScene(accessor: SceneAppendAccessor): SceneModel | null {
  const levelId = accessor.currentLevelId;
  return levelId ? accessor.getLevelScene(levelId) : null;
}

/**
 * Commit the cut-line chain for `[cutStart, cutEnd]` placed toward `placement`.
 * Returns the number of dimensions added (0 when nothing to dimension).
 */
export function commitCutLineChain(
  cutStart: Point2D,
  cutEnd: Point2D,
  placement: Point2D,
  options: AutoDimensionOptions,
  accessor: SceneAppendAccessor,
): number {
  const scene = activeScene(accessor);
  if (!scene) return 0;
  const segments = planCutLineChain(scene.entities, cutStart, cutEnd, placement, options);
  if (segments.length === 0) return 0;
  const style = getDimStyleRegistry().getActiveStyle();
  const layerId = getLayer(DXF_DEFAULT_LAYER)?.id ?? '0';
  const dims = buildAutoDimensionEntities(segments, { styleId: style.id, layerId, style });
  if (dims.length === 0) return 0;
  addDimensionsToScene(dims, accessor);
  return dims.length;
}

/**
 * Advance the cut-line FSM on a (snapped) canvas click. Called from the central
 * click dispatcher while `activeTool === 'auto-dim-cutline'`.
 *   click1 → start · click2 → end · click3 → commit + rearm (continuous).
 */
export function advanceCutlineClick(worldPoint: Point2D, accessor: SceneAppendAccessor): void {
  const s = getCutlineSession();
  if (s.phase === 'awaitingStart') {
    setCutlineStart(worldPoint);
    return;
  }
  if (s.phase === 'awaitingEnd') {
    setCutlineEnd(worldPoint);
    return;
  }
  if (s.phase === 'awaitingPlacement' && s.cutStart && s.cutEnd && s.options) {
    commitCutLineChain(s.cutStart, s.cutEnd, worldPoint, s.options, accessor);
    rearmCutline(); // ArchiCAD continuous — start another cut line (Esc exits).
  }
}

/**
 * Build the live ghost-chain preview meta for the placement phase — the same
 * planner output mapped to `GhostFaceDimension[]` (rendered by the existing
 * `drawGhostFaceDimensions` overlay). Returns null when <2 crossings.
 */
export function buildCutlinePreviewMeta(
  scene: SceneModel,
  cutStart: Point2D,
  cutEnd: Point2D,
  placement: Point2D,
  options: AutoDimensionOptions,
): GhostFaceDimensionsMeta | null {
  const segments = planCutLineChain(scene.entities, cutStart, cutEnd, placement, options);
  if (segments.length === 0) return null;
  const dims: GhostFaceDimension[] = segments.map((seg) => {
    const [p1, p2, dimLineRef] = seg.defPoints;
    return {
      kind: 'centerToCenter',
      p1,
      p2,
      dimLineRef,
      valueScene: Math.hypot(p2.x - p1.x, p2.y - p1.y),
    };
  });
  return { sceneUnits: resolveSceneUnits(scene), dims };
}
