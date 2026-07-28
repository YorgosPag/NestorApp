/**
 * ADR-650 Milestone 1 — basic survey-point parser tests.
 */

import { parseTopoPoints } from '../parse-topo-points';

describe('parseTopoPoints', () => {
  it('parses X Y Z lines (metres → canonical mm)', () => {
    const { points, skipped } = parseTopoPoints('10 20 5\n11 21 6');
    expect(skipped).toEqual([]);
    expect(points).toEqual([
      { x: 10000, y: 20000, z: 5000 },
      { x: 11000, y: 21000, z: 6000 },
    ]);
  });

  it('accepts comma / semicolon / tab delimiters and a 4th code field', () => {
    const { points } = parseTopoPoints('10,20,5,EDGE\n11;21;6\n12\t22\t7');
    expect(points[0]).toEqual({ x: 10000, y: 20000, z: 5000, code: 'EDGE' });
    expect(points[1]).toEqual({ x: 11000, y: 21000, z: 6000 });
    expect(points[2]).toEqual({ x: 12000, y: 22000, z: 7000 });
  });

  it('skips blank lines, comments and rows with no POSITION (reporting their line numbers)', () => {
    const { points, skipped } = parseTopoPoints('# header\n10 20 5\n\n// note\nbad row here\n11 21');
    // ADR-720 — `11 21` is a survey point measured in plan only, NOT a malformed row. Before this
    // ADR it was reported as skipped, which is how a file's parcel corners came to be discarded.
    expect(points).toHaveLength(2);
    expect(points[1]).toEqual({ x: 11000, y: 21000 });
    expect(skipped).toEqual([5]); // only "bad row here" — non-numeric, genuinely not a point
  });

  it('ADR-720 — a line without the third number yields a planimetric point, no `z` key at all', () => {
    const { points, skipped } = parseTopoPoints('10 20');
    expect(skipped).toEqual([]);
    // `toEqual` ignores undefined-valued keys, so assert the KEY is absent explicitly: a stored
    // `z: undefined` would survive Firestore as a second shape meaning "no elevation".
    expect(Object.prototype.hasOwnProperty.call(points[0]!, 'z')).toBe(false);
    expect(points[0]).toEqual({ x: 10000, y: 20000 });
  });

  it('honours a custom unit scale (already-mm input → scale 1)', () => {
    const { points } = parseTopoPoints('100 200 3', 1);
    expect(points[0]).toEqual({ x: 100, y: 200, z: 3 });
  });
});
