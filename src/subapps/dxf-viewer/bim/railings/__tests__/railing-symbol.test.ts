/**
 * ADR-407 Φ1 — railing 2Δ plan symbol unit tests.
 */

import { buildRailingSymbol } from '../railing-symbol';
import { computeRailingGeometry } from '../railing-geometry';
import type { RailingParams } from '../../types/railing-types';
import { DEFAULT_RAILING_TYPE, DEFAULT_RAILING_TOTAL_HEIGHT_MM } from '../../types/railing-types';

function straightParams(): RailingParams {
  return {
    type: DEFAULT_RAILING_TYPE,
    pathSource: { kind: 'sketch', path: [{ x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }] },
    totalHeightMm: DEFAULT_RAILING_TOTAL_HEIGHT_MM,
    baseElevationMm: 0,
    sceneUnits: 'mm',
  };
}

describe('buildRailingSymbol', () => {
  it('emits the path centreline as the stroke', () => {
    const params = straightParams();
    const sym = buildRailingSymbol(params, computeRailingGeometry(params));
    expect(sym.pathStroke).toHaveLength(2);
    expect(sym.pathStroke[1].x).toBeCloseTo(1000);
  });

  it('emits one closed square outline per post (rectangular profile → 4 corners)', () => {
    const params = straightParams();
    const sym = buildRailingSymbol(params, computeRailingGeometry(params));
    expect(sym.postMarks).toHaveLength(2);
    expect(sym.postMarks[0]).toHaveLength(4);
    // 40mm square centred on the start post → corners at ±20.
    const xs = sym.postMarks[0].map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(40);
  });

  it('emits one dot per baluster', () => {
    const params = straightParams();
    const g = computeRailingGeometry(params);
    const sym = buildRailingSymbol(params, g);
    expect(sym.balusterMarks).toHaveLength(g.balusters.length);
  });
});
