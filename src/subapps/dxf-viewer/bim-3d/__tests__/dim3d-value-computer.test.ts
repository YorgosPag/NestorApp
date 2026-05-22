/**
 * ADR-366 Phase 9 / C.3 — Value Computer unit tests.
 */

import {
  computeAlignedValue,
  computeAngularValue,
  computeDim3DValue,
  computeLinearValue,
  computeRadialValue,
  formatDim3DValue,
} from '../dimensions/dim3d-value-computer';
import type { Dim3DAnchor } from '../dimensions/dim3d-types';

const baseAnchor: Dim3DAnchor = {
  endpointA: { x: 0, y: 0, z: 0 },
  endpointB: { x: 3, y: 4, z: 0 },
};

describe('computeAlignedValue', () => {
  it('returns Euclidean distance', () => {
    expect(computeAlignedValue(baseAnchor)).toBeCloseTo(5);
  });

  it('returns 0 when endpoints coincide', () => {
    expect(
      computeAlignedValue({
        endpointA: { x: 1, y: 1, z: 1 },
        endpointB: { x: 1, y: 1, z: 1 },
      }),
    ).toBe(0);
  });
});

describe('computeLinearValue', () => {
  it('projects on X axis', () => {
    expect(computeLinearValue(baseAnchor, 'X')).toBe(3);
  });

  it('projects on Y axis', () => {
    expect(computeLinearValue(baseAnchor, 'Y')).toBe(4);
  });

  it('projects on Z axis', () => {
    expect(computeLinearValue(baseAnchor, 'Z')).toBe(0);
  });

  it('projects on entity-local axis', () => {
    const value = computeLinearValue(baseAnchor, 'entityLocal', { x: 0, y: 1, z: 0 });
    expect(value).toBe(4);
  });

  it('throws if entityLocal axis vector missing', () => {
    expect(() => computeLinearValue(baseAnchor, 'entityLocal')).toThrow();
  });
});

describe('computeRadialValue', () => {
  it('returns distance from anchor A to center', () => {
    const center = { x: 0, y: 0, z: 0 };
    const anchor: Dim3DAnchor = {
      endpointA: { x: 5, y: 0, z: 0 },
      endpointB: { x: 5, y: 0, z: 0 },
    };
    expect(computeRadialValue(anchor, center)).toBe(5);
  });
});

describe('computeAngularValue', () => {
  it('returns 90 degrees for orthogonal rays', () => {
    const value = computeAngularValue(
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
    );
    expect(value).toBeCloseTo(90, 3);
  });

  it('returns 0 degrees for identical rays', () => {
    const value = computeAngularValue(
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
    );
    expect(value).toBeCloseTo(0, 3);
  });
});

describe('computeDim3DValue dispatcher', () => {
  it('routes aligned mode', () => {
    expect(computeDim3DValue('aligned', {}, baseAnchor)).toBeCloseTo(5);
  });

  it('routes linear mode with default X axis', () => {
    expect(computeDim3DValue('linear', { linear: { axis: 'X' } }, baseAnchor)).toBe(3);
  });

  it('routes radial mode', () => {
    expect(
      computeDim3DValue(
        'radial',
        { radial: { center: { x: 0, y: 0, z: 0 }, radius: 5 } },
        { endpointA: { x: 5, y: 0, z: 0 }, endpointB: { x: 5, y: 0, z: 0 } },
      ),
    ).toBe(5);
  });

  it('throws on angular without placement', () => {
    expect(() => computeDim3DValue('angular', {}, baseAnchor)).toThrow();
  });
});

describe('formatDim3DValue', () => {
  it('formats meters with precision', () => {
    expect(formatDim3DValue(1.234, 'm', 2, 'aligned')).toBe('1.23 m');
  });

  it('formats millimeters with scale conversion', () => {
    expect(formatDim3DValue(1.234, 'mm', 0, 'aligned')).toBe('1234 mm');
  });

  it('formats angular with degree symbol', () => {
    expect(formatDim3DValue(45.5, 'm', 1, 'angular')).toBe('45.5°');
  });
});
