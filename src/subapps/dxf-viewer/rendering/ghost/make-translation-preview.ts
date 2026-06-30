/**
 * SSOT — make-translation-preview
 *
 * Builds a synthetic preview that translates an entire entity by `delta`.
 * Used by the Move tool (toolbar) to express each selected entity as a
 * standard `EntityPreviewTransform` so the same `applyEntityPreview` SSOT
 * applies to both grip-drag and wholesale-translation paths.
 *
 * Extracted from `apply-entity-preview` (file-size SRP split) — it is a
 * preview *builder*, distinct from the preview *transform* function.
 *
 * @see rendering/ghost/apply-entity-preview — companion transform SSoT
 * @see ADR-049 — Move Tool / Grip Drag SSoT
 */

import type { Point2D } from '../types/Types';
import type { EntityPreviewTransform } from './entity-preview-types';

/**
 * Build a synthetic preview that translates an entire entity by `delta`.
 * Used by the Move tool (toolbar) to express each selected entity as a
 * standard `EntityPreviewTransform` so the same SSOT applies.
 */
export function makeTranslationPreview(entityId: string, delta: Point2D): EntityPreviewTransform {
  return { entityId, gripIndex: -1, delta, movesEntity: true };
}
