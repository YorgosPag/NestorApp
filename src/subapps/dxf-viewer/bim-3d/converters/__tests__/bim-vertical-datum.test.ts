/**
 * ADR-448 §4.1 — vertical render-datum SSoT (`hangDownMeshY` / `floorBaseMeshY` /
 * `centeredMeshY`). Pure-math test: imports ONLY the shape-helpers module (no
 * firestore import chain), so it runs without the converter-suite `fetch` polyfill.
 *
 * Regression guard for the «δοκάρι αόρατο στη θεμελίωση» bug (2026-06-16, Giorgio):
 * a FLOOR-RELATIVE structural top (beam/slab) was placed at the building datum
 * (world 0) instead of the storey FFL. On the foundation level (FFL world −1m +
 * View-Range cut plane at world 0) the beam landed 1m too high → above the cut
 * plane → clipped → invisible, while the footings (absolute elevation) showed.
 */

import { hangDownMeshY, floorBaseMeshY, centeredMeshY } from '../bim-three-shape-helpers';

const MM_TO_M = 0.001;

describe('hangDownMeshY — top-anchored solids (beam / slab / hanging fixture)', () => {
  it('ground floor (FFL=0): top at relMm, body hangs down by bodyHeight', () => {
    // beam top 1000mm, depth 0.5m → top world 1.0m, bottom (position.y) 0.5m.
    expect(hangDownMeshY(0, 1000, 0.5)).toBeCloseTo(0.5, 6);
  });

  it('foundation FFL (−1000mm): same floor-relative top lands 1m LOWER → at/below the world-0 cut plane (THE FIX)', () => {
    const ground = hangDownMeshY(0, 1000, 0.5);
    const foundation = hangDownMeshY(-1000, 1000, 0.5);
    expect(foundation).toBeCloseTo(-0.5, 6); // bottom at −0.5m, top at world 0
    expect(foundation - ground).toBeCloseTo(-1, 6); // exactly one storey FFL lower
    expect(foundation).toBeLessThanOrEqual(0); // ≤ foundation cut plane (world 0) → visible
  });

  it('building base offset adds linearly', () => {
    expect(hangDownMeshY(0, 1000, 0.5, 12)).toBeCloseTo(12.5, 6);
  });

  it('FFL=0 reproduces the legacy formula (zero regression on the ground floor)', () => {
    const topMm = 2800;
    const bodyHeightM = 0.2;
    const base = 3;
    expect(hangDownMeshY(0, topMm, bodyHeightM, base)).toBeCloseTo(
      topMm * MM_TO_M - bodyHeightM + base,
      6,
    );
  });
});

describe('floorBaseMeshY — bottom-anchored solids (floor-standing fixtures)', () => {
  it('bottom face at FFL + relMm', () => {
    expect(floorBaseMeshY(0, 300)).toBeCloseTo(0.3, 6);
    expect(floorBaseMeshY(3000, 0)).toBeCloseTo(3, 6); // 1st floor FFL
    expect(floorBaseMeshY(-1000, 0)).toBeCloseTo(-1, 6); // foundation FFL
  });
});

describe('centeredMeshY — centre-anchored solids (panel / manifold / radiator / boiler / DHW)', () => {
  it('box centred on FFL + relMm, bottom at centre − bodyHeight/2', () => {
    expect(centeredMeshY(0, 1500, 0.8)).toBeCloseTo(1.1, 6); // 1.5 − 0.4
    expect(centeredMeshY(-1000, 1000, 0.8)).toBeCloseTo(-0.4, 6); // 0 − 0.4
  });

  it('FFL=0 reproduces the legacy centred formula (zero regression)', () => {
    const centerMm = 1200;
    const bodyHeightM = 0.6;
    expect(centeredMeshY(0, centerMm, bodyHeightM)).toBeCloseTo(
      centerMm * MM_TO_M - bodyHeightM / 2,
      6,
    );
  });
});
