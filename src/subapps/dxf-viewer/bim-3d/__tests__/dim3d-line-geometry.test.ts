/**
 * ADR-366 Phase 9 / C.3 — Line geometry builder unit tests.
 */

import {
  DIM3D_DEFAULT_LAYOUT_OPTIONS,
  buildDim3DLineLayout,
} from '../dimensions/dim3d-line-geometry';
import type { Dim3DAnchor } from '../dimensions/dim3d-types';

const baseAnchor: Dim3DAnchor = {
  endpointA: { x: 0, y: 0, z: 0 },
  endpointB: { x: 3, y: 0, z: 0 },
};

describe('buildDim3DLineLayout — aligned', () => {
  it('produces 2 dim line points', () => {
    const layout = buildDim3DLineLayout('aligned', {}, baseAnchor, DIM3D_DEFAULT_LAYOUT_OPTIONS);
    expect(layout.dimLine).toHaveLength(2);
  });

  it('produces 2 arrows facing outward', () => {
    const layout = buildDim3DLineLayout('aligned', {}, baseAnchor, DIM3D_DEFAULT_LAYOUT_OPTIONS);
    expect(layout.arrows).toHaveLength(2);
    expect(layout.arrows[0].direction.x).toBeCloseTo(-1);
    expect(layout.arrows[1].direction.x).toBeCloseTo(1);
  });

  it('places text anchor between dim line and text offset', () => {
    const layout = buildDim3DLineLayout('aligned', {}, baseAnchor, DIM3D_DEFAULT_LAYOUT_OPTIONS);
    expect(layout.textAnchor.x).toBeCloseTo(1.5, 5);
  });

  it('L-shape leader has 4 points (2 segments)', () => {
    const layout = buildDim3DLineLayout('aligned', {}, baseAnchor, {
      ...DIM3D_DEFAULT_LAYOUT_OPTIONS,
      leaderShape: 'L',
    });
    expect(layout.leaderLines).toHaveLength(4);
  });

  it('straight leader has 2 points (1 segment)', () => {
    const layout = buildDim3DLineLayout('aligned', {}, baseAnchor, {
      ...DIM3D_DEFAULT_LAYOUT_OPTIONS,
      leaderShape: 'straight',
    });
    expect(layout.leaderLines).toHaveLength(2);
  });
});

describe('buildDim3DLineLayout — radial', () => {
  it('produces center → endpoint dim line', () => {
    const center = { x: 0, y: 0, z: 0 };
    const anchor: Dim3DAnchor = {
      endpointA: { x: 5, y: 0, z: 0 },
      endpointB: { x: 5, y: 0, z: 0 },
    };
    const layout = buildDim3DLineLayout(
      'radial',
      { radial: { center, radius: 5 } },
      anchor,
      DIM3D_DEFAULT_LAYOUT_OPTIONS,
    );
    expect(layout.dimLine[0]).toEqual(center);
    expect(layout.dimLine[1]).toEqual(anchor.endpointA);
  });

  it('returns 1 arrow at endpoint', () => {
    const layout = buildDim3DLineLayout(
      'radial',
      { radial: { center: { x: 0, y: 0, z: 0 }, radius: 5 } },
      { endpointA: { x: 5, y: 0, z: 0 }, endpointB: { x: 5, y: 0, z: 0 } },
      DIM3D_DEFAULT_LAYOUT_OPTIONS,
    );
    expect(layout.arrows).toHaveLength(1);
  });
});

describe('buildDim3DLineLayout — angular', () => {
  it('produces arc endpoints on rays', () => {
    const vertex = { x: 0, y: 0, z: 0 };
    const rayA = { x: 1, y: 0, z: 0 };
    const rayB = { x: 0, y: 1, z: 0 };
    const layout = buildDim3DLineLayout(
      'angular',
      { angular: { vertex, rayA, rayB } },
      { endpointA: vertex, endpointB: vertex },
      DIM3D_DEFAULT_LAYOUT_OPTIONS,
    );
    expect(layout.dimLine).toHaveLength(2);
    expect(layout.arrows).toHaveLength(2);
  });

  it('throws when placement.angular missing', () => {
    expect(() =>
      buildDim3DLineLayout(
        'angular',
        {},
        { endpointA: { x: 0, y: 0, z: 0 }, endpointB: { x: 0, y: 0, z: 0 } },
        DIM3D_DEFAULT_LAYOUT_OPTIONS,
      ),
    ).toThrow();
  });
});
