/**
 * ADR-510 Φ2E #2 — the render EntityModel must carry the per-object linetype scale
 * (CELTSCALE «Βήμα») so the stroke-time dash sizer (`applyEntityLinetypeDash`, which
 * reads `entity.ltscale` off THIS model) scales the dashes. Regression: the ribbon
 * «Βήμα» edit was silently dropped (always 1) because the converter omitted the field
 * (dashed lines can only reach this per-entity path, so the scale was lost everywhere).
 */

import type { DxfEntityUnion } from '../dxf-types';
import { buildEntityModelFromDxf } from '../dxf-renderer-entity-model';
import type { ComplexLinetypeDef } from '../../../config/complex-linetype-types';

const resolved = { colorHex: '#fff', lineWidthPx: 1, alpha: 1, dashMm: [4, 2] };

// ADR-642 Φ2-B — a `──GAS──` complex linetype (embedded text) resolved onto the style.
const gasComplex: ComplexLinetypeDef = {
  name: 'GAS', description: '', origin: 'user-created',
  layers: [{ elements: [
    { kind: 'dash', lengthMm: 5 },
    { kind: 'gap', lengthMm: 2 },
    { kind: 'text', value: 'GAS', styleId: 'arial', scale: 1, rotationDeg: 0, offsetXMm: 0, offsetYMm: 0, followPath: true },
    { kind: 'gap', lengthMm: 5 },
  ] }],
};

function line(extra: Record<string, unknown> = {}): DxfEntityUnion {
  return {
    id: 'l1', visible: true, type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 },
    ...extra,
  } as unknown as DxfEntityUnion;
}

describe('buildEntityModelFromDxf — line CELTSCALE «Βήμα» passthrough (ADR-510 Φ2E #2)', () => {
  it('carries a non-default ltscale onto the render EntityModel', () => {
    const m = buildEntityModelFromDxf(line({ ltscale: 2 }), false, resolved) as unknown as { ltscale?: number };
    expect(m.ltscale).toBe(2);
  });

  it('carries a fractional ltscale (denser dashes)', () => {
    const m = buildEntityModelFromDxf(line({ ltscale: 0.5 }), false, resolved) as unknown as { ltscale?: number };
    expect(m.ltscale).toBe(0.5);
  });

  it('omits ltscale when it is the 1 default (zero regression)', () => {
    const m = buildEntityModelFromDxf(line({ ltscale: 1 }), false, resolved) as unknown as { ltscale?: number };
    expect(m.ltscale).toBeUndefined();
  });

  it('omits ltscale when absent', () => {
    const m = buildEntityModelFromDxf(line(), false, resolved) as unknown as { ltscale?: number };
    expect(m.ltscale).toBeUndefined();
  });
});

describe('buildEntityModelFromDxf — complex linetype passthrough (ADR-642 Φ2-B)', () => {
  it('carries the resolved complex def onto the render EntityModel (full-canvas ──GAS──)', () => {
    const m = buildEntityModelFromDxf(
      line(), false, { ...resolved, complex: gasComplex },
    ) as unknown as { complex?: ComplexLinetypeDef };
    expect(m.complex).toBe(gasComplex);
  });

  it('omits complex when the resolved style has none (zero regression, solid/dash path)', () => {
    const m = buildEntityModelFromDxf(line(), false, resolved) as unknown as { complex?: ComplexLinetypeDef };
    expect(m.complex).toBeUndefined();
  });
});
