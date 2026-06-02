/**
 * ADR-407 Φ1 — railing geometry generation engine + validation unit tests.
 */

import {
  computeRailingGeometry,
  validateRailingParams,
} from '../railing-geometry';
import type { RailingParams, RailingType } from '../../types/railing-types';
import {
  DEFAULT_RAILING_TYPE,
  DEFAULT_RAILING_TOTAL_HEIGHT_MM,
} from '../../types/railing-types';

/** Type clone with a patched baluster spacing (mm). */
function typeWithSpacing(spacingMm: number): RailingType {
  return {
    ...DEFAULT_RAILING_TYPE,
    balusterPlacement: {
      ...DEFAULT_RAILING_TYPE.balusterPlacement,
      pattern: { ...DEFAULT_RAILING_TYPE.balusterPlacement.pattern, spacingMm },
    },
  };
}

/** A straight 1000mm sketch railing along +x (mm scene → s = 1). */
function straightParams(overrides: Partial<RailingParams> = {}): RailingParams {
  return {
    type: DEFAULT_RAILING_TYPE,
    pathSource: { kind: 'sketch', path: [{ x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }] },
    totalHeightMm: DEFAULT_RAILING_TOTAL_HEIGHT_MM,
    baseElevationMm: 0,
    sceneUnits: 'mm',
    ...overrides,
  };
}

describe('computeRailingGeometry — straight sketch path', () => {
  it('places end posts at both vertices (start + end)', () => {
    const g = computeRailingGeometry(straightParams());
    expect(g.posts).toHaveLength(2);
    expect(g.posts[0].basePoint.x).toBeCloseTo(0);
    expect(g.posts[1].basePoint.x).toBeCloseTo(1000);
    expect(g.posts[0].heightMm).toBe(DEFAULT_RAILING_TOTAL_HEIGHT_MM);
  });

  it('spaces balusters at the ball-rule gap, endpoints excluded (posts cover them)', () => {
    const g = computeRailingGeometry(straightParams());
    // 1000mm / 100mm → 10 gaps → 9 interior balusters.
    expect(g.balusters).toHaveLength(9);
    const xs = g.balusters.map((b) => b.basePoint.x);
    expect(Math.min(...xs)).toBeCloseTo(100);
    expect(Math.max(...xs)).toBeCloseTo(900);
  });

  it('keeps the realised baluster clear spacing ≤ 100mm', () => {
    const g = computeRailingGeometry(straightParams());
    const xs = [0, ...g.balusters.map((b) => b.basePoint.x), 1000].sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeLessThanOrEqual(100 + 1e-6);
  });

  it('builds a single centred top rail at the datum + height', () => {
    const g = computeRailingGeometry(straightParams());
    const top = g.rails.filter((r) => r.role === 'top-rail');
    expect(top).toHaveLength(1);
    expect(top[0].path[0].z).toBeCloseTo(1000); // base 0 + topRail.heightMm 1000
  });

  it('runs balusters up to the top-rail underside (height − ½ profile)', () => {
    const g = computeRailingGeometry(straightParams());
    expect(g.balusters[0].heightMm).toBeCloseTo(975); // 1000 − 50/2
  });

  it('reports running length in metres for the BOQ feed', () => {
    expect(computeRailingGeometry(straightParams()).lengthM).toBeCloseTo(1.0, 6);
  });

  it('bbox spans the path xy and the full height in z', () => {
    const g = computeRailingGeometry(straightParams());
    expect(g.bbox.min).toMatchObject({ x: 0, y: 0, z: 0 });
    expect(g.bbox.max).toMatchObject({ x: 1000, y: 0, z: 1000 });
  });
});

describe('computeRailingGeometry — scene units', () => {
  it('keeps member counts invariant when the scene is in metres', () => {
    const g = computeRailingGeometry(straightParams({
      pathSource: { kind: 'sketch', path: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }] },
      sceneUnits: 'm',
    }));
    expect(g.posts).toHaveLength(2);
    expect(g.balusters).toHaveLength(9); // 1m / 0.1 (=100mm×0.001) → 10 gaps
    expect(g.lengthM).toBeCloseTo(1.0, 6);
  });
});

describe('computeRailingGeometry — degenerate path', () => {
  it('returns empty members for a sub-2-point path (validator guards upstream)', () => {
    const g = computeRailingGeometry(straightParams({
      pathSource: { kind: 'sketch', path: [{ x: 0, y: 0, z: 0 }] },
    }));
    expect(g.posts).toHaveLength(0);
    expect(g.balusters).toHaveLength(0);
    expect(g.lengthM).toBe(0);
  });
});

describe('validateRailingParams', () => {
  it('passes clean for the default guardrail type', () => {
    const r = validateRailingParams(straightParams());
    expect(r.hardErrors).toHaveLength(0);
    expect(r.codeViolations).toHaveLength(0); // 1000mm height + 100mm gap are both compliant
  });

  it('hard-errors on a sub-2-point sketch path', () => {
    const r = validateRailingParams(straightParams({
      pathSource: { kind: 'sketch', path: [{ x: 0, y: 0, z: 0 }] },
    }));
    expect(r.hardErrors).toContain('railing.validation.hardErrors.pathTooShort');
  });

  it('hard-errors on non-positive total height', () => {
    expect(validateRailingParams(straightParams({ totalHeightMm: 0 })).hardErrors)
      .toContain('railing.validation.hardErrors.nonPositiveHeight');
  });

  it('warns (code violation) when guardrail height is out of the 1000–1100mm band', () => {
    const r = validateRailingParams(straightParams({ totalHeightMm: 1200 }));
    expect(r.hardErrors).toHaveLength(0);
    expect(r.codeViolations).toContain('railing.validation.codeViolations.guardrailHeight');
  });

  it('warns (code violation) when the baluster gap exceeds the 10cm ball rule', () => {
    const r = validateRailingParams(straightParams({ type: typeWithSpacing(150) }));
    expect(r.codeViolations).toContain('railing.validation.codeViolations.balusterGap');
  });
});
