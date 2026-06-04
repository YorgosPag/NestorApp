/**
 * ADR-408 Φ11 — classifyJunction tests (junction topology → fitting kind).
 *
 * Covers the full 6-type topology table:
 *   1 incident                 → cap
 *   2 collinear, same Ø        → coupling
 *   2 collinear, different Ø   → reducer
 *   2 angled                   → elbow
 *   3 incidents                → tee
 *   4 incidents                → cross
 *   ≥5 incidents               → null (no standard fitting)
 */

import type { PipeJunction } from '../../mep-systems/mep-pipe-junctions';
import type { Point3D } from '../../types/bim-base';
import type { MepFittingIncident } from '../../types/mep-fitting-types';
import { DEFAULT_ELBOW_STYLE } from '../../types/mep-fitting-types';
import { classifyJunction } from '../mep-fitting-classify';

/** Build a single incident with a given direction + diameter. */
const incident = (
  segmentId: string,
  directionUnit: Point3D,
  diameterMm: number,
): MepFittingIncident => ({
  segmentId,
  connectorId: 'seg-start',
  directionUnit,
  diameterMm,
});

/** Build a PipeJunction fixture from a list of incidents. */
const junction = (incidents: MepFittingIncident[]): PipeJunction => ({
  key: '0:0',
  position: { x: 0, y: 0, z: 0 },
  centerlineElevationMm: 0,
  incidents,
});

const RIGHT: Point3D = { x: 1, y: 0, z: 0 };
const LEFT: Point3D = { x: -1, y: 0, z: 0 };
const UP: Point3D = { x: 0, y: 1, z: 0 };
const DOWN: Point3D = { x: 0, y: -1, z: 0 };

describe('classifyJunction — full topology table', () => {
  it('1 incident → cap', () => {
    const result = classifyJunction(junction([incident('a', RIGHT, 50)]));
    expect(result.kind).toBe('cap');
    expect(result.primaryDiameterMm).toBe(50);
    expect(result.secondaryDiameterMm).toBeUndefined();
  });

  it('2 collinear, same Ø → coupling', () => {
    const result = classifyJunction(
      junction([incident('a', RIGHT, 50), incident('b', LEFT, 50)]),
    );
    expect(result.kind).toBe('coupling');
    expect(result.primaryDiameterMm).toBe(50);
    expect(result.secondaryDiameterMm).toBeUndefined();
  });

  it('2 collinear, different Ø → reducer (primary = larger, secondary = smaller)', () => {
    const result = classifyJunction(
      junction([incident('a', RIGHT, 50), incident('b', LEFT, 32)]),
    );
    expect(result.kind).toBe('reducer');
    expect(result.primaryDiameterMm).toBe(50);
    expect(result.secondaryDiameterMm).toBe(32);
  });

  it('2 angled (perpendicular) → elbow (radiused default)', () => {
    const result = classifyJunction(
      junction([incident('a', RIGHT, 50), incident('b', UP, 50)]),
    );
    expect(result.kind).toBe('elbow');
    expect(result.elbowStyle).toBe(DEFAULT_ELBOW_STYLE);
    expect(result.secondaryDiameterMm).toBeUndefined();
  });

  it('3 incidents → tee', () => {
    const result = classifyJunction(
      junction([incident('a', RIGHT, 50), incident('b', LEFT, 50), incident('c', UP, 50)]),
    );
    expect(result.kind).toBe('tee');
    expect(result.primaryDiameterMm).toBe(50);
  });

  it('4 incidents → cross', () => {
    const result = classifyJunction(
      junction([
        incident('a', RIGHT, 50),
        incident('b', LEFT, 50),
        incident('c', UP, 50),
        incident('d', DOWN, 50),
      ]),
    );
    expect(result.kind).toBe('cross');
    expect(result.primaryDiameterMm).toBe(50);
  });

  it('5 incidents → null (no standard fitting)', () => {
    const result = classifyJunction(
      junction([
        incident('a', RIGHT, 50),
        incident('b', LEFT, 50),
        incident('c', UP, 50),
        incident('d', DOWN, 50),
        incident('e', { x: 0.7, y: 0.7, z: 0 }, 50),
      ]),
    );
    expect(result.kind).toBeNull();
    // primary Ø is still reported even when the kind is unclassifiable.
    expect(result.primaryDiameterMm).toBe(50);
  });
});

describe('classifyJunction — edge cases of the 2-incident branch', () => {
  it('treats a tiny Ø difference (≤1mm) as a coupling, not a reducer', () => {
    const result = classifyJunction(
      junction([incident('a', RIGHT, 50), incident('b', LEFT, 50.5)]),
    );
    expect(result.kind).toBe('coupling');
  });

  it('classifies a near-collinear pair (≈8° bend) as a coupling/reducer, not an elbow', () => {
    // dot ≈ -0.99 (well past the -0.985 collinear threshold) → still inline.
    const slightBend: Point3D = { x: -0.99, y: 0.141, z: 0 };
    const result = classifyJunction(
      junction([incident('a', RIGHT, 50), incident('b', slightBend, 50)]),
    );
    expect(result.kind).toBe('coupling');
  });

  it('classifies a clearly angled pair (≈20° from straight) as an elbow', () => {
    // dot ≈ -0.94 (above the -0.985 threshold) → angled → elbow.
    const bend: Point3D = { x: -0.94, y: 0.342, z: 0 };
    const result = classifyJunction(
      junction([incident('a', RIGHT, 50), incident('b', bend, 50)]),
    );
    expect(result.kind).toBe('elbow');
  });

  it('reports primary Ø = the larger incident for an elbow with mixed diameters', () => {
    const result = classifyJunction(
      junction([incident('a', RIGHT, 40), incident('b', UP, 63)]),
    );
    expect(result.kind).toBe('elbow');
    expect(result.primaryDiameterMm).toBe(63);
  });

  it('angled + differing Ø → REDUCING elbow (carries the smaller Ø to taper)', () => {
    const result = classifyJunction(
      junction([incident('a', RIGHT, 250), incident('b', UP, 50)]),
    );
    expect(result.kind).toBe('elbow');
    expect(result.elbowStyle).toBe(DEFAULT_ELBOW_STYLE);
    expect(result.primaryDiameterMm).toBe(250);
    expect(result.secondaryDiameterMm).toBe(50);
  });

  it('angled + same Ø → plain elbow (no secondary diameter)', () => {
    const result = classifyJunction(
      junction([incident('a', RIGHT, 50), incident('b', UP, 50)]),
    );
    expect(result.kind).toBe('elbow');
    expect(result.secondaryDiameterMm).toBeUndefined();
  });
});
