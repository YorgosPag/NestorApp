/**
 * ADR-563 — engine orchestrator (end-to-end, synthetic plan).
 */

import { runAutoDimension, computeOverallBounds } from '../auto-dimension-engine';
import { AUTO_DIMENSION_DEFAULTS } from '../auto-dimension-types';
import { getDimStyleRegistry } from '../../dim-style-registry';
import { makeBimMock } from './auto-dim-test-mocks';

const CTX = { styleId: 'dimstyle_iso_129', layerId: 'lyr_dims' };

const c1 = makeBimMock('column', 'c1', 0, 0, 400, 400);
const c2 = makeBimMock('column', 'c2', 2000, 0, 2400, 400);
const wall = makeBimMock('wall', 'w1', 0, 0, 2400, 200);

describe('computeOverallBounds', () => {
  it('unions the 2D bounds of all BIM elements', () => {
    expect(computeOverallBounds([c1, c2])).toEqual({
      min: { x: 0, y: 0 },
      max: { x: 2400, y: 400 },
    });
  });

  it('returns null when no element has usable geometry', () => {
    const line = { id: 'l1', type: 'line' } as unknown as Parameters<typeof computeOverallBounds>[0][number];
    expect(computeOverallBounds([line])).toBeNull();
  });
});

describe('runAutoDimension', () => {
  it('produces linear dimension entities for a small plan', () => {
    const dims = runAutoDimension([c1, c2, wall], AUTO_DIMENSION_DEFAULTS, CTX);
    expect(dims.length).toBeGreaterThan(0);
    expect(dims.every((d) => d.type === 'dimension')).toBe(true);
    expect(dims.every((d) => d.dimensionType === 'linear')).toBe(true);
  });

  it('places chains on all four enabled sides', () => {
    const dims = runAutoDimension([c1, c2], AUTO_DIMENSION_DEFAULTS, CTX);
    const horizontal = dims.filter((d) => d.rotation === 0).length; // N/S
    const vertical = dims.filter((d) => d.rotation === 90).length; // E/W
    expect(horizontal).toBeGreaterThan(0);
    expect(vertical).toBeGreaterThan(0);
  });

  it('returns [] for an empty / non-dimensionable set', () => {
    expect(runAutoDimension([], AUTO_DIMENSION_DEFAULTS, CTX)).toEqual([]);
  });

  it('Φ3 — adds interior chains only when interior is enabled', () => {
    const perimeterOnly = runAutoDimension([c1, c2], AUTO_DIMENSION_DEFAULTS, CTX);
    const withInterior = runAutoDimension(
      [c1, c2],
      { ...AUTO_DIMENSION_DEFAULTS, interior: true },
      CTX,
    );
    // c1/c2 differ on X only → one extra interior horizontal (X) chain segment.
    expect(withInterior.length).toBe(perimeterOnly.length + 1);
  });

  it('keeps valid dimensions when the geometry-builder sanity check runs (real style)', () => {
    // The command flow passes a resolved style → factory runs buildDimensionGeometry.
    // Guard against it silently dropping every (valid) segment.
    const style = getDimStyleRegistry().getActiveStyle();
    const withoutSanity = runAutoDimension([c1, c2, wall], AUTO_DIMENSION_DEFAULTS, CTX);
    const withSanity = runAutoDimension([c1, c2, wall], AUTO_DIMENSION_DEFAULTS, {
      styleId: style.id,
      layerId: 'lyr_dims',
      style,
    });
    expect(withSanity.length).toBe(withoutSanity.length);
    expect(withSanity.length).toBeGreaterThan(0);
  });
});
