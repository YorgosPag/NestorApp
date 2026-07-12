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

import type { BlockEntity, Entity } from '../../types/entities';
import { isBlockEntity } from '../../types/entities';
import type { SceneModel, AnySceneEntity } from '../../types/scene';
import { DxfSceneBuilder } from '../../utils/dxf-scene-builder';
// ADR-641 — the real-size/recenter VIEW transform (def→view) + its enter-time-fixed getter, so the
// editor shows the block at world size framed on the origin (Revit/ArchiCAD/Figma parity).
import type { BlockEditViewTransform } from './block-edit-view-transform';
import { viewFromDef } from './block-edit-view-transform';
import { getActiveBlockEditId, getBlockEditViewTransform } from './ActiveBlockEditStore';
import { findEntityOrBlockMember } from './block-member-scene-access';

/** Options for {@link buildBlockEditScene}: the enter-time VIEW transform + the world scene's units. */
export interface BuildBlockEditSceneOptions {
  /**
   * ADR-641 — the real-size/recenter VIEW transform. When present the members are mapped def→view
   * (`Scale·(m − C)`) so the editor shows the block at its world size framed on the origin; when
   * `null`/absent the members render verbatim (definition space — legacy behaviour, still used by the
   * pure unit tests that don't set a transform).
   */
  transform?: BlockEditViewTransform | null;
  /** The world scene's units, inherited so the ruler/cursor/snap read the block in the drawing's unit
   *  system (the members are now at world magnitude via `transform`). Defaults to `'mm'`. */
  units?: SceneModel['units'];
}

/**
 * Build the exclusive {@link SceneModel} for editing `block`. `layersById` is the parent scene's
 * id-keyed layer map (passed through so the members' `layerId`s resolve to real layers / colours).
 *
 * With a VIEW `transform` (ADR-641) the members are cloned and mapped def→view (real-world size,
 * recentred on the origin), so the canvas shows the block the way it appears placed in the drawing;
 * edits committed through the member write-back are inverse-transformed back to the canonical
 * `block.entities` (def space), so this build reflects them on the next rebuild. Without a transform
 * (unit tests / degenerate) the members render verbatim. A fresh `entities` array reference is returned
 * each call (React memo correctness).
 */
export function buildBlockEditScene(
  block: BlockEntity,
  layersById: SceneModel['layersById'],
  opts: BuildBlockEditSceneOptions = {},
): SceneModel {
  const { transform, units } = opts;
  const entities = transform
    ? block.entities.map((m) => viewFromDef(m as AnySceneEntity, transform) as typeof m)
    : [...block.entities];
  return {
    entities,
    layersById,
    bounds: DxfSceneBuilder.calculateBounds(entities as AnySceneEntity[]),
    units: units ?? 'mm',
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
  // ADR-641 — feed the enter-time VIEW transform (real-size + recenter) + the world units so the
  // editor build is at world magnitude in the drawing's unit system. `getBlockEditViewTransform()`
  // returns null when no transform was captured (legacy/tests) → verbatim definition-space build.
  return buildBlockEditScene(block, scene.layersById, {
    transform: getBlockEditViewTransform(),
    units: scene.units,
  });
}

/**
 * ADR-641 — event-time resolve of an id to the entity the EDITOR operates on: a top-level entity, or
 * — while a Block Editor session is open — the active block's member forward-transformed into the
 * editor's VIEW frame (real-size/recentred), matching exactly what the canvas shows. The SSoT the
 * preview/ghost hooks call so a member's move/rotate ghost renders in the right frame (outside BEDIT it
 * is a plain top-level lookup — `getActiveBlockEditId()` is null). Reuses {@link findEntityOrBlockMember}.
 */
export function resolveEffectiveEntityById(
  entities: readonly Entity[] | undefined,
  id: string,
): Entity | null {
  return findEntityOrBlockMember(entities, id, getActiveBlockEditId(), getBlockEditViewTransform());
}
