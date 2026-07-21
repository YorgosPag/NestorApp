/**
 * SSOT — draw-real-entity-preview
 *
 * Renders a transformed drag-preview entity through the REAL entity renderer
 * (`EntityRendererComposite` via `BimPreviewRenderer`) onto the PreviewCanvas,
 * so the moving copy shows the entity's FULL final appearance — wall thickness +
 * category fill + poché + material hatch, column footprint + fill, etc. — exactly
 * as it will look once committed. Replaces the simplified silhouette-only
 * `drawGhostEntity` for the moving copy (the original-position copy stays a ghost).
 *
 * Shared by both move flows so the two cannot visually diverge:
 *   - useGripGhostPreview   (grip drag — reshape/move of any entity type)
 *   - useMovePreview        (toolbar Move tool, 2-click translation)
 *
 * The entity model is built through the SAME `buildEntityModelFromDxf` +
 * `resolveEntityRenderStyle` path the committed canvas uses, so ByLayer/ACI/
 * TrueColor colour, lineweight and dash are byte-identical to the real render.
 *
 * @see canvas-v2/preview-canvas/bim-preview-render.ts — the real composite on the preview ctx
 * @see canvas-v2/dxf-canvas/dxf-renderer-style-resolve.ts — style SSoT
 * @see ADR-550 — Unified Entity Render Contract
 * @see ADR-049 — Move tool / grip drag SSoT · ADR-040 — Preview Canvas Performance
 */

import type { Point2D, ViewTransform, Viewport } from '../types/Types';
import type { Entity, SceneLayer } from '../../types/entities';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { BimPreviewRenderer } from '../../canvas-v2/preview-canvas/bim-preview-render';
import { buildEntityModelFromDxf } from '../../canvas-v2/dxf-canvas/dxf-renderer-entity-model';
import { resolveEntityRenderStyle } from '../../canvas-v2/dxf-canvas/dxf-renderer-style-resolve';
import { DXF_WRAPPED_SUBENTITY_FIELD, dxfSubEntityPayload, type DxfWrappedType } from '../../canvas-v2/dxf-canvas/dxf-types';
import { applyEntityPreview } from './apply-entity-preview';
import { makeTranslationPreview } from './make-translation-preview';

/**
 * ADR-363/ADR-550 — normalise a preview entity into a VALID `DxfEntityUnion` before
 * `buildEntityModelFromDxf` (the SSoT DxfEntityUnion→Entity mapper shared with the
 * committed canvas) reads it.
 *
 * WHY: the preview pipeline (grip drag `useGripGhostPreview` + Move tool `useMovePreview`)
 * runs `applyEntityPreview` on the FLAT scene entity — it reads `.params`/`.geometry`
 * at top level (see its slab/opening branches) and returns them flat. But five variants
 * carry their payload in a sub-entity wrapper (`slab`→`slabEntity`, `slab-opening`→
 * `slabOpeningEntity`, `opening`→`openingEntity`, `stair`→`stairEntity`, `dimension`→
 * `dimensionEntity`), which `buildEntityModelFromDxf` dereferences unconditionally
 * (`s.kind`). On the committed path the entity is wrapped by `convertEntity`
 * (dxf-scene-entity-converter); the preview path skipped that step, so a moving slab/
 * opening ghost dereferenced `undefined.kind` and crashed the RAF draw.
 *
 * Nest the flat entity into its own payload via the SAME SSoT `convertEntity` uses
 * (`dxfSubEntityPayload` + `DXF_WRAPPED_SUBENTITY_FIELD`) — one source for the field
 * names, zero duplication. No-op for direct entities (wall/beam/column/foundation/…)
 * and for already-wrapped ones (stair, which `applyEntityPreview` re-wraps itself).
 */
function toWrappedPreviewEntity(entity: DxfEntityUnion): DxfEntityUnion {
  const field = DXF_WRAPPED_SUBENTITY_FIELD[entity.type as DxfWrappedType];
  if (!field) return entity; // direct entity — read flat, no wrapper needed
  const rec = entity as unknown as Record<string, unknown>;
  if (rec[field]) return entity; // already wrapped (e.g. stair from applyEntityPreview)
  return { ...rec, ...dxfSubEntityPayload(entity) } as unknown as DxfEntityUnion;
}

/**
 * Draw one already-transformed preview entity at full real fidelity on the
 * preview overlay. `layersById` (from the level scene) drives ByLayer/ByBlock
 * style resolution; pass the canonical `viewport` the harness feeds so the
 * y-flip matches the main canvas (ADR-398).
 */
export function drawRealEntityPreview(
  bimPreview: BimPreviewRenderer,
  transformed: DxfEntityUnion,
  layersById: Record<string, SceneLayer> | undefined,
  transform: ViewTransform,
  viewport: Viewport,
): void {
  // ADR-363/ADR-550 — wrap flat slab/opening/… previews into the sub-entity payload
  // the SSoT model builder dereferences (mirrors `convertEntity` on the committed path).
  const renderable = toWrappedPreviewEntity(transformed);
  const resolved = resolveEntityRenderStyle(renderable, layersById);
  const model = buildEntityModelFromDxf(renderable, false, resolved);
  bimPreview.render(model, transform, viewport);
}

const TRANSLATION_EPSILON = 0.001;

/**
 * SSoT translated-selection ghost — draws SOLID WYSIWYG copies of a selection at a
 * translation `delta`, one per resolvable id. Owns the whole chrome (sub-`TRANSLATION_EPSILON`
 * no-op guard + `ctx.save()/restore()` + the per-entity translate → real-render loop) so BOTH
 * 2-click flows call it in ONE statement and cannot diverge (N.18 — no parallel twins):
 *   - useMovePreview — original dims via `movePreviewActive`, ghost lands at destination
 *   - useCopyPreview — original stays SOLID (a copy duplicates), only the clone ghost moves
 * The caller still owns the base-marker + rubber-band chrome (those differ per tool).
 */
export function drawTranslatedEntitiesPreview(params: {
  ctx: CanvasRenderingContext2D;
  bimPreview: BimPreviewRenderer;
  selectedEntityIds: readonly string[];
  delta: Point2D;
  getEntity: (id: string) => Entity | null;
  layersById: Record<string, SceneLayer> | undefined;
  transform: ViewTransform;
  viewport: Viewport;
}): void {
  const { ctx, bimPreview, selectedEntityIds, delta, getEntity, layersById, transform, viewport } = params;
  if (Math.abs(delta.x) <= TRANSLATION_EPSILON && Math.abs(delta.y) <= TRANSLATION_EPSILON) return;
  ctx.save();
  for (const entityId of selectedEntityIds) {
    const entity = getEntity(entityId);
    if (!entity) continue;
    const preview = makeTranslationPreview(entityId, delta);
    const transformed = applyEntityPreview(entity as unknown as DxfEntityUnion, preview);
    drawRealEntityPreview(bimPreview, transformed, layersById, transform, viewport);
  }
  ctx.restore();
}
