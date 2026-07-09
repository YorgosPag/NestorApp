/**
 * ADR-583 / ADR-612 — Spatial-index bounds for the annotation-family entities
 * (annotation-symbol / scale-bar / opening-info-tag).
 *
 * Standalone helpers extracted from `Bounds.ts` to keep that file within the
 * 500-line Google budget (CLAUDE.md N.7.1). Mirrors the `bounds-parametric-line.ts`
 * extraction pattern (ADR-359 Phase 11 follow-up): standalone exported functions,
 * `BoundingBox` / `createBoundingBox` imported back from `./Bounds`.
 */

import type { EntityModel } from '../types/Types';
import { createBoundingBox, type BoundingBox } from './Bounds';
// ADR-583 — annotative model-size SSoT for the North-arrow annotation symbol.
import { annotationSymbolModelSizeLive } from '../../bim/annotation-symbols/annotation-symbol-model-size';
import { DEFAULT_ANNOTATION_SYMBOL_SIZE_MM } from '../../types/annotation-symbol';
// ADR-583 Φ2 — graphic scale-bar axis-extent bbox + live annotative half-thickness SSoT.
import { computeScaleBarGeometry } from '../../bim/geometry/scale-bar-geometry';
import { scaleBarModelHalfThicknessLive } from '../../bim/scale-bar/scale-bar-hit';
import type { ScaleBarEntity } from '../../types/scale-bar';
// ADR-612 — opening info tag broad-phase bbox SSoT (sibling of scale-bar, world-mm — no annotative term).
import { calculateOpeningInfoTagBounds as computeOpeningInfoTagBoundsBox } from '../../bim/opening-info-tag/opening-info-tag-hit';
import type { OpeningInfoTagEntity } from '../../types/opening-info-tag';

/**
 * ADR-583 — annotation symbol (North arrow) spatial bounds. The paper `sizeMm`
 * is folded to model units at the live drawing scale (same SSoT the renderer +
 * `entity-bounds` use), giving a square footprint around the insertion point that
 * the broad-phase index / hover pre-filter can enclose.
 */
export function calculateAnnotationSymbolBounds(entity: EntityModel, tolerance: number): BoundingBox {
  const e = entity as EntityModel & { position: { x: number; y: number }; sizeMm?: number };
  const modelSize = annotationSymbolModelSizeLive(e.sizeMm ?? DEFAULT_ANNOTATION_SYMBOL_SIZE_MM);
  const half = modelSize / 2 + tolerance;
  return createBoundingBox(
    e.position.x - half,
    e.position.y - half,
    e.position.x + half,
    e.position.y + half,
  );
}

/**
 * ADR-583 Φ2 — graphic scale-bar spatial bounds. The DERIVED axis-extent bbox
 * (scale-invariant canonical-mm from `computeScaleBarGeometry`, hence the `(1,'mm')`
 * placeholders) padded on all sides by the LIVE annotative half-thickness — the same
 * `±halfThickness` corridor `hitTestScaleBarAxis` gates on — so the broad phase always
 * encloses the narrow phase. Without this the axis bbox is a zero-height line and the
 * candidate is dropped whenever the cursor sits on the drawn band (mirror annotation-symbol).
 */
export function calculateScaleBarBounds(entity: EntityModel, tolerance: number): BoundingBox {
  const e = entity as unknown as ScaleBarEntity;
  const { bbox } = computeScaleBarGeometry(e, 1, 'mm');
  const pad = scaleBarModelHalfThicknessLive(e) + tolerance;
  return createBoundingBox(
    bbox.minX - pad,
    bbox.minY - pad,
    bbox.maxX + pad,
    bbox.maxY + pad,
  );
}

/**
 * ADR-612 — opening info tag spatial bounds. Mirror `calculateScaleBarBounds`
 * but WITHOUT the annotative half-thickness pad — the tag's box is entirely
 * world canonical-mm, so the rotation-aware AABB itself (padded only by
 * `tolerance`) already encloses the narrow phase (`hitTestOpeningInfoTag`).
 */
export function calculateOpeningInfoTagBounds(entity: EntityModel, tolerance: number): BoundingBox {
  const e = entity as unknown as OpeningInfoTagEntity;
  const bbox = computeOpeningInfoTagBoundsBox(e, tolerance);
  return createBoundingBox(bbox.minX, bbox.minY, bbox.maxX, bbox.maxY);
}
