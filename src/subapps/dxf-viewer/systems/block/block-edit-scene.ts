/**
 * ADR-641 — synthetic BLOCK-LOCAL scene for the Block Editor (BEDIT).
 *
 * While a block is entered, the canvas renders ONLY that block's members, positioned in
 * **BLOCK-LOCAL** space (base at origin) — the AutoCAD block-editor space. This builder wraps
 * `block.entities` into a minimal {@link SceneModel} the existing `convertScene` → render pipeline
 * already understands.
 *
 * Crucially it is the LOCAL-space counterpart of {@link expandBlockInstance}: it does **NOT** apply
 * the placement transform (`applyBlockTransformGeometry`) — members are already stored base-baked-to-
 * origin (ADR-640 Fork-2), so identity placement is correct — and it does **NOT** re-tag member ids
 * to the block id, so each member keeps its own id and grips / hit-test target the individual member
 * (exactly like GROUP direct members when drilled in). Nothing else is in this scene, so hover /
 * selection / grips scope to the editable members for free (no id-filtering needed).
 *
 * Pure: members are referenced (not cloned), so edits committed to the live `block.entities` through
 * the member-aware command path (ADR-641 Φ4) reflect on the next build. Bounds reuse the
 * `DxfSceneBuilder.calculateBounds` SSoT (no re-implemented bbox math, N.18).
 */

import type { BlockEntity } from '../../types/entities';
import { isBlockEntity } from '../../types/entities';
import type { SceneModel } from '../../types/scene';
import { DxfSceneBuilder } from '../../utils/dxf-scene-builder';

/**
 * Build the exclusive block-local {@link SceneModel} for editing `block`. `layersById` is the parent
 * scene's id-keyed layer map (passed through so the members' `layerId`s resolve to real layers /
 * colours). A fresh `entities` array reference is returned each call (React memo correctness) while
 * the member objects themselves are shared with `block.entities` (live edits render on rebuild).
 */
export function buildBlockEditScene(
  block: BlockEntity,
  layersById: SceneModel['layersById'],
): SceneModel {
  const entities = [...block.entities];
  return {
    entities,
    layersById,
    // Members live in block-local space (base @ origin) — identity placement, no transform applied.
    bounds: DxfSceneBuilder.calculateBounds(entities),
    units: 'mm',
  };
}

/**
 * ADR-641 Φ2 — the exclusive-render-scope SSoT resolver. Given the raw world {@link SceneModel} and
 * the currently-entered block id (`getActiveBlockEditId()`), returns the scene the canvas should
 * ACTUALLY render:
 *
 * - `activeBlockEditId === null` (top level) → the raw world scene unchanged.
 * - a BlockEntity with that id exists → its block-local {@link buildBlockEditScene} (EXCLUSIVE editor).
 * - the id no longer resolves to a block (block deleted, or the active level was switched out from
 *   under an open editor) → the raw world scene as a safe fallback, so the canvas never blanks.
 *
 * Pure and reference-stable-friendly: when nothing is entered it returns the SAME `scene` reference
 * it was given, so a `useMemo` over it doesn't churn. Consumers (the canvas render leaf AND the
 * container gizmo/overlay leaves) all read THIS one result, so hit-test / hover / grips / whole-
 * container highlight scope to the members «for free» — no id-filtering, no coordinate-frame gap
 * (ADR-641 §2).
 */
export function resolveBlockEditScene(
  scene: SceneModel | null,
  activeBlockEditId: string | null,
): SceneModel | null {
  if (!activeBlockEditId || !scene) return scene;
  const block = scene.entities.find(
    (e): e is BlockEntity => e.id === activeBlockEditId && isBlockEntity(e),
  );
  if (!block) return scene;
  return buildBlockEditScene(block, scene.layersById);
}
