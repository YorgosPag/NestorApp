/**
 * ADR-408 Φ15 Task B — deriveRisersThroughFloor (cross-floor «riser through»).
 *
 * Pins the Revit «cut plane» annotation rule: a vertical riser of another floor
 * gets a derived plan mark on every floor its z-span crosses, EXCEPT its own
 * authored base floor (owner — drawn full by `renderRiser`). Non-vertical and
 * out-of-span segments are skipped.
 */

import { deriveRisersThroughFloor } from '../derive-risers-through-floor';
import { deriveCenterlineElevationMm } from '../../types/mep-segment-types';
import type { MepSegmentEntity } from '../../types/mep-segment-types';
import type { PlumbingSystemClassification } from '../../types/mep-connector-types';

/** A vertical riser at plan (x,y) spanning startZ→endZ (datum-relative mm). */
function riser(
  id: string,
  x: number,
  y: number,
  startZ: number,
  endZ: number,
  classification?: PlumbingSystemClassification,
): MepSegmentEntity {
  return {
    id,
    type: 'mep-segment',
    kind: 'pipe',
    params: {
      domain: 'pipe',
      sectionKind: 'round',
      startPoint: { x, y, z: startZ },
      endPoint: { x, y, z: endZ },
      diameter: 100,
      centerlineElevationMm: deriveCenterlineElevationMm(startZ, endZ),
      ...(classification ? { classification } : {}),
    },
  } as unknown as MepSegmentEntity;
}

/** A horizontal pipe (plan run > 0, no rise) — must never read as a riser. */
function horizontal(id: string): MepSegmentEntity {
  return {
    id,
    type: 'mep-segment',
    kind: 'pipe',
    params: {
      domain: 'pipe',
      sectionKind: 'round',
      startPoint: { x: 0, y: 0, z: 3000 },
      endPoint: { x: 2000, y: 0, z: 3000 },
      diameter: 100,
      centerlineElevationMm: 3000,
    },
  } as unknown as MepSegmentEntity;
}

describe('deriveRisersThroughFloor (ADR-408 Φ15 Task B)', () => {
  // Riser from ground (z=0, owner) up to z=9000, passing floors at 3000 / 6000.
  const upRiser = riser('r-up', 100, 200, 0, 9000, 'sanitary-drainage');

  it('marks an intermediate floor the riser passes through (arrow up)', () => {
    const marks = deriveRisersThroughFloor([upRiser], 3000);
    expect(marks).toHaveLength(1);
    expect(marks[0].centreXY).toEqual({ x: 100, y: 200 });
    expect(marks[0].direction).toBe('up');
    expect(marks[0].classification).toBe('sanitary-drainage');
  });

  it('marks the top floor at the span boundary (FFL == max z)', () => {
    expect(deriveRisersThroughFloor([upRiser], 9000)).toHaveLength(1);
  });

  it('EXCLUDES the owner (authored base) floor — no double with renderRiser', () => {
    expect(deriveRisersThroughFloor([upRiser], 0)).toHaveLength(0);
  });

  it('skips floors above / below the riser span', () => {
    expect(deriveRisersThroughFloor([upRiser], 12000)).toHaveLength(0);
    expect(deriveRisersThroughFloor([upRiser], -3000)).toHaveLength(0);
  });

  it('emits a DOWN arrow for a riser authored at the top draining downward', () => {
    // Owner base = top (startPoint z=9000), draining to z=0.
    const downRiser = riser('r-dn', 50, 60, 9000, 0);
    const marks = deriveRisersThroughFloor([downRiser], 3000);
    expect(marks).toHaveLength(1);
    expect(marks[0].direction).toBe('down');
    // Owner floor (z=9000) excluded.
    expect(deriveRisersThroughFloor([downRiser], 9000)).toHaveLength(0);
    // Lower floor it reaches (z=0) IS marked (not the owner here).
    expect(deriveRisersThroughFloor([downRiser], 0)).toHaveLength(1);
  });

  it('skips non-vertical (horizontal) segments', () => {
    expect(deriveRisersThroughFloor([horizontal('h1')], 3000)).toHaveLength(0);
  });

  it('absorbs sub-mm FFL drift at the span boundary (tolerance)', () => {
    expect(deriveRisersThroughFloor([upRiser], 9000.5)).toHaveLength(1);
  });

  it('handles a mixed list and a stack with no crossing risers', () => {
    const other = riser('r2', 500, 500, 3000, 6000); // owner base 3000
    const marks = deriveRisersThroughFloor([upRiser, other, horizontal('h')], 6000);
    // upRiser crosses 6000 (up); other's base is 6000? no — its base is 3000, top 6000 → boundary, not owner → marked.
    expect(marks).toHaveLength(2);
  });
});
