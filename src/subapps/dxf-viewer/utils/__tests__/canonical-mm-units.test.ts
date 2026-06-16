/**
 * ADR-462 — canonical-mm units SSoT tests.
 *
 * Locks: (1) the import source-unit resolution (incl. the Greek lying-mm case),
 * (2) resolveSceneUnits trusting the canonical declaration, (3) the mm scale
 * factors, and (4) end-to-end DxfSceneBuilder scaling of geometry to mm.
 */

import {
  mmToSceneUnits,
  resolveSceneUnits,
  resolveImportSourceUnits,
} from '../scene-units';
import { DxfSceneBuilder } from '../dxf-scene-builder';

describe('mmToSceneUnits — factors', () => {
  it('maps each unit to its mm scale', () => {
    expect(mmToSceneUnits('mm')).toBe(1);
    expect(mmToSceneUnits('cm')).toBe(0.1);
    expect(mmToSceneUnits('m')).toBe(0.001);
  });
});

describe('resolveImportSourceUnits — ADR-462 import detection', () => {
  const metresBounds = { min: { x: 8, y: 1 }, max: { x: 43, y: 30 } };   // ~45 diag → m
  const mmBounds = { min: { x: 0, y: 0 }, max: { x: 40000, y: 30000 } };  // 50k+ → mm

  it('trusts an honest $INSUNITS', () => {
    expect(resolveImportSourceUnits('m', metresBounds)).toBe('m');
    expect(resolveImportSourceUnits('mm', mmBounds)).toBe('mm');
  });

  it('OVERRIDES a lying mm declaration when geometry is metre-scale (Greek DXF)', () => {
    // $INSUNITS = mm but a whole floorplan is only ~45 units → really metres.
    expect(resolveImportSourceUnits('mm', metresBounds)).toBe('m');
  });

  it('falls back to the bounds heuristic when $INSUNITS is absent', () => {
    expect(resolveImportSourceUnits(null, metresBounds)).toBe('m');
    expect(resolveImportSourceUnits(null, mmBounds)).toBe('mm');
  });

  it('defaults to mm with no signal at all', () => {
    expect(resolveImportSourceUnits(null, null)).toBe('mm');
  });
});

describe('resolveSceneUnits — ADR-462 trusts the canonical declaration', () => {
  it('returns the declared unit, including mm, WITHOUT re-guessing from bounds', () => {
    // A real mm scene whose small bounds would historically be mis-detected as metres.
    const scene = { units: 'mm', bounds: { min: { x: 0, y: 0 }, max: { x: 35, y: 28 } } };
    expect(resolveSceneUnits(scene)).toBe('mm');
  });

  it('still infers from bounds for legacy unitless scenes', () => {
    const scene = { units: null, bounds: { min: { x: 0, y: 0 }, max: { x: 35, y: 28 } } };
    expect(resolveSceneUnits(scene)).toBe('m');
  });
});

// Minimal DXF with a single LINE (0,0)→(10,0) and a configurable $INSUNITS.
function makeDxf(insunits: number): string {
  return [
    '0', 'SECTION', '2', 'HEADER',
    '9', '$INSUNITS', '70', String(insunits),
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
    '0', 'LINE', '8', '0',
    '10', '0', '20', '0',
    '11', '10', '21', '0',
    '0', 'ENDSEC', '0', 'EOF',
  ].join('\n');
}

describe('DxfSceneBuilder.buildScene — canonical-mm scaling', () => {
  it('scales a metre DXF (×1000) and stamps units = mm', () => {
    const scene = DxfSceneBuilder.buildScene(makeDxf(6)); // 6 = metres
    expect(scene.units).toBe('mm');
    const line = scene.entities.find((e) => e.type === 'line') as { start: { x: number }; end: { x: number } } | undefined;
    expect(line).toBeDefined();
    expect(line!.end.x).toBeCloseTo(10000); // 10 m → 10000 mm
  });

  it('leaves an mm DXF unscaled (identity) and stamps units = mm', () => {
    const scene = DxfSceneBuilder.buildScene(makeDxf(4)); // 4 = mm, geometry tiny but honest-ish
    expect(scene.units).toBe('mm');
  });

  it('honours an explicit wizard override over $INSUNITS', () => {
    // $INSUNITS says mm(4) but the user declares metres → ×1000.
    const scene = DxfSceneBuilder.buildScene(makeDxf(4), 'm');
    const line = scene.entities.find((e) => e.type === 'line') as { end: { x: number } } | undefined;
    expect(scene.units).toBe('mm');
    expect(line!.end.x).toBeCloseTo(10000);
  });
});
