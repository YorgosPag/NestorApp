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

import type { ViewTransform, Viewport } from '../types/Types';
import type { SceneLayer } from '../../types/entities';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { BimPreviewRenderer } from '../../canvas-v2/preview-canvas/bim-preview-render';
import { buildEntityModelFromDxf } from '../../canvas-v2/dxf-canvas/dxf-renderer-entity-model';
import { resolveEntityRenderStyle } from '../../canvas-v2/dxf-canvas/dxf-renderer-style-resolve';

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
  const resolved = resolveEntityRenderStyle(transformed, layersById);
  const model = buildEntityModelFromDxf(transformed, false, resolved);
  bimPreview.render(model, transform, viewport);
}
