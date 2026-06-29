/**
 * ADR-550 — the WYSIWYG moving-copy preview builds its EntityModel through the SAME
 * committed-canvas path (`resolveEntityRenderStyle` → `buildEntityModelFromDxf`) and
 * hands it to the REAL renderer (`BimPreviewRenderer.render`). This locks the wiring so
 * the preview cannot silently fall back to the raw union (wrong ByLayer/ACI colour).
 */
import type { ViewTransform, Viewport } from '../../types/Types';
import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';
import type { SceneLayer } from '../../../types/entities';
import type { BimPreviewRenderer } from '../../../canvas-v2/preview-canvas/bim-preview-render';

const buildEntityModelFromDxf = jest.fn();
const resolveEntityRenderStyle = jest.fn();
jest.mock('../../../canvas-v2/dxf-canvas/dxf-renderer-entity-model', () => ({
  buildEntityModelFromDxf: (...a: unknown[]) => buildEntityModelFromDxf(...a),
}));
jest.mock('../../../canvas-v2/dxf-canvas/dxf-renderer-style-resolve', () => ({
  resolveEntityRenderStyle: (...a: unknown[]) => resolveEntityRenderStyle(...a),
}));

import { drawRealEntityPreview } from '../draw-real-entity-preview';

describe('drawRealEntityPreview', () => {
  it('resolves style + builds the model (not the raw union) and renders it real', () => {
    const STYLE = { colorHex: '#abcdef', lineWidthPx: 2, alpha: 1, dashMm: [] };
    const MODEL = { id: 'e1', type: 'wall' };
    resolveEntityRenderStyle.mockReturnValue(STYLE);
    buildEntityModelFromDxf.mockReturnValue(MODEL);

    const render = jest.fn();
    const bimPreview = { render } as unknown as BimPreviewRenderer;
    const entity = { id: 'e1', type: 'wall', layerId: 'L1' } as unknown as DxfEntityUnion;
    const layers = { L1: {} } as unknown as Record<string, SceneLayer>;
    const t: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
    const vp: Viewport = { width: 100, height: 100 };

    drawRealEntityPreview(bimPreview, entity, layers, t, vp);

    expect(resolveEntityRenderStyle).toHaveBeenCalledWith(entity, layers);
    // isSelected MUST be false (preview is not a selection), style forwarded verbatim.
    expect(buildEntityModelFromDxf).toHaveBeenCalledWith(entity, false, STYLE);
    expect(render).toHaveBeenCalledWith(MODEL, t, vp);
  });
});
