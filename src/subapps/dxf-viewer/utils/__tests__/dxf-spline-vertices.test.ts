/**
 * ADR-507 follow-up — SPLINE control points survive the flat-`data` collapse.
 *
 * A DXF SPLINE stores its control points as repeated code-10/20 pairs. The flat
 * `EntityData.data` map overwrites repeated codes, so `convertSpline` used to see a
 * single point and DROP every multi-CV spline (<2) — the real-file symptom was a
 * geo-referenced survey losing all 10 contour splines ("Skipped SPLINE×10"). The fix
 * reads the ordered `pairs` (the same mechanism LWPOLYLINE/HATCH already use).
 */

import { DxfSceneBuilder } from '../dxf-scene-builder';

// Minimal DXF with ONE cubic SPLINE carrying 4 control points (codes 73=4, 10/20 ×4).
function makeSplineDxf(): string {
  return [
    '0', 'SECTION', '2', 'HEADER',
    '9', '$INSUNITS', '70', '6', // metres — keeps scaling honest, irrelevant to vertex count
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
    '0', 'SPLINE', '8', '0',
    '70', '8', '71', '3', '72', '8', '73', '4', '74', '0',
    '40', '0', '40', '0', '40', '0', '40', '0', '40', '1', '40', '1', '40', '1', '40', '1',
    '10', '0', '20', '0',
    '10', '10', '20', '5',
    '10', '20', '20', '5',
    '10', '30', '20', '0',
    '0', 'ENDSEC', '0', 'EOF',
  ].join('\n');
}

describe('convertSpline — control points via ordered pairs', () => {
  it('keeps ALL control points (no <2 drop) and marks the curve smoothDisplay', () => {
    const { scene, diagnostics } = DxfSceneBuilder.buildSceneWithDiagnostics(makeSplineDxf());

    const poly = scene.entities.find(
      (e): e is { type: string; vertices: unknown[]; smoothDisplay?: boolean; id: string } =>
        e.type === 'polyline' && typeof (e as { id?: string }).id === 'string' &&
        (e as { id: string }).id.startsWith('spline_'),
    );

    expect(poly).toBeDefined();
    expect(poly!.vertices).toHaveLength(4); // was 1 → dropped before the fix
    expect(poly!.smoothDisplay).toBe(true);
    // And it must NOT be recorded as a skipped/unsupported entity.
    expect(diagnostics.skippedByType?.SPLINE ?? 0).toBe(0);
  });
});
