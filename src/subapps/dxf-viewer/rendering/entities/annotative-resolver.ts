/**
 * ADR-344 Phase 11 — Annotative entity height resolver.
 *
 * Pure function called by `EntityRendererComposite` BEFORE dispatching to
 * `TextRenderer`. For annotative TEXT/MTEXT entities, returns a shallow clone
 * with `height` replaced by the model-space height of the viewport's active
 * annotation scale. For non-annotative entities, returns the entity unchanged.
 *
 * WHY external to TextRenderer: `TextRenderer.ts` carries an explicit
 * "DO NOT add annotation scaling" lockdown comment. The annotation logic
 * lives upstream so the renderer stays the simple `height × scale` path.
 *
 * Reads `ViewportStore` via getter (no subscription) per ADR-040 cardinal
 * rule #3 — event-time read in an imperative render path.
 */

import { getActiveScaleName } from '../../systems/viewport/ViewportStore';
import type { Entity, TextEntity, MTextEntity, EntityAnnotationScale } from '../../types/entities';
import { isTextEntity, isMTextEntity } from '../../types/entities';

/**
 * If `entity` is annotative and the viewport's active scale is in its scale
 * list, returns a shallow clone with `height` overridden by the scale's
 * `modelHeight`. Otherwise returns the entity untouched.
 */
export function resolveAnnotativeEntity(entity: Entity): Entity {
  if (!isTextEntity(entity) && !isMTextEntity(entity)) return entity;
  const textEntity = entity as TextEntity | MTextEntity;
  if (!textEntity.isAnnotative) return entity;

  const scales = textEntity.annotationScales;
  if (!scales || scales.length === 0) return entity;

  const activeName = getActiveScaleName();
  const resolved = pickActiveScale(scales, activeName);
  if (!resolved) return entity;

  return { ...textEntity, height: resolved.modelHeight } as Entity;
}

/**
 * Look up `activeName` in `scales`. Falls back to the first scale if active
 * not present (matches AutoCAD behavior of using "current annotation scale"
 * as a soft pointer).
 */
function pickActiveScale(
  scales: readonly EntityAnnotationScale[],
  activeName: string,
): EntityAnnotationScale | null {
  const exact = scales.find((s) => s.name === activeName);
  if (exact) return exact;
  return scales[0] ?? null;
}
