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

  // ADR-363/ADR-550 — the preview pipeline feeds a FLAT scene slab (kind/params/geometry
  // at top level, NO `slabEntity` wrapper). `buildEntityModelFromDxf` dereferences
  // `entity.slabEntity.kind` unconditionally, so without a wrap the moving-slab ghost
  // crashed (`Cannot read properties of undefined (reading 'kind')`). Assert we nest the
  // flat entity into its own payload before building the model.
  it('wraps a flat slab into slabEntity so the SSoT model builder can dereference it', () => {
    resolveEntityRenderStyle.mockReturnValue({ colorHex: '#fff', lineWidthPx: 1, alpha: 1 });
    buildEntityModelFromDxf.mockReturnValue({ id: 's1', type: 'slab' });

    const render = jest.fn();
    const bimPreview = { render } as unknown as BimPreviewRenderer;
    // Flat SlabEntity as it leaves `applyEntityPreview` — no `slabEntity` wrapper.
    const flatSlab = {
      id: 's1', type: 'slab', kind: 'floor',
      params: { thickness: 200 }, geometry: { polygon: [] },
    } as unknown as DxfEntityUnion;
    const t: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
    const vp: Viewport = { width: 10, height: 10 };

    drawRealEntityPreview(bimPreview, flatSlab, undefined, t, vp);

    const built = buildEntityModelFromDxf.mock.calls[0][0] as { slabEntity?: unknown };
    expect(built.slabEntity).toBe(flatSlab);
    // The wrapped payload must expose the fields the builder reads.
    expect((built.slabEntity as { kind?: string }).kind).toBe('floor');
    // Same normalised entity is used for style resolution (single wrap, no divergence).
    expect(resolveEntityRenderStyle.mock.calls[0][0]).toBe(built);
  });

  it.each([
    ['slab-opening', 'slabOpeningEntity'],
    ['opening', 'openingEntity'],
    ['dimension', 'dimensionEntity'],
  ])('wraps a flat %s into %s', (type, field) => {
    resolveEntityRenderStyle.mockReturnValue({ colorHex: '#fff', lineWidthPx: 1, alpha: 1 });
    buildEntityModelFromDxf.mockReturnValue({ id: 'x', type });
    const render = jest.fn();
    const flat = { id: 'x', type, kind: 'k', params: {}, geometry: {} } as unknown as DxfEntityUnion;
    const t: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };

    drawRealEntityPreview({ render } as unknown as BimPreviewRenderer, flat, undefined, t, { width: 1, height: 1 });

    const built = buildEntityModelFromDxf.mock.calls[0][0] as Record<string, unknown>;
    expect(built[field]).toBe(flat);
  });

  it.each(['wall', 'beam', 'column', 'foundation'])(
    'leaves a direct %s entity untouched (no wrapper)',
    (type) => {
      resolveEntityRenderStyle.mockReturnValue({ colorHex: '#fff', lineWidthPx: 1, alpha: 1 });
      buildEntityModelFromDxf.mockReturnValue({ id: 'd', type });
      const render = jest.fn();
      const direct = { id: 'd', type, kind: 'k', params: {}, geometry: {} } as unknown as DxfEntityUnion;
      const t: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };

      drawRealEntityPreview({ render } as unknown as BimPreviewRenderer, direct, undefined, t, { width: 1, height: 1 });

      // Direct entities read fields flat → passed through by reference, no clone/wrap.
      expect(buildEntityModelFromDxf.mock.calls[0][0]).toBe(direct);
    },
  );

  it('does not double-wrap an already-wrapped stair', () => {
    resolveEntityRenderStyle.mockReturnValue({ colorHex: '#fff', lineWidthPx: 1, alpha: 1 });
    buildEntityModelFromDxf.mockReturnValue({ id: 'st', type: 'stair' });
    const render = jest.fn();
    // `applyEntityPreview` re-wraps stair itself → arrives with `stairEntity` present.
    const innerStair = { kind: 'straight', params: {}, geometry: {} };
    const wrappedStair = { id: 'st', type: 'stair', stairEntity: innerStair } as unknown as DxfEntityUnion;
    const t: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };

    drawRealEntityPreview({ render } as unknown as BimPreviewRenderer, wrappedStair, undefined, t, { width: 1, height: 1 });

    const built = buildEntityModelFromDxf.mock.calls[0][0] as { stairEntity?: unknown };
    // Untouched: same reference, inner payload preserved (not re-nested).
    expect(buildEntityModelFromDxf.mock.calls[0][0]).toBe(wrappedStair);
    expect(built.stairEntity).toBe(innerStair);
  });
});
