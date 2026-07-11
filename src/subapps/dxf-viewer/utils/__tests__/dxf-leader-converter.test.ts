/**
 * ADR-635 Φάση B Batch 2 Part B — LEADER → LeaderEntity converter.
 *
 * Proves: ordered path vertices from `pairs` (arrow tip = vertices[0], not the flat-map
 * last-10/20), arrowhead flag (71) default-on / explicit-off, DIMASZ default size, color
 * (62), and the <2-vertex skip.
 */
import { convertLeader } from '../dxf-leader-converter';
import { DEFAULT_DIMSTYLE } from '../dxf-parser-types';
import type { EntityData } from '../dxf-converter-helpers';

type LeaderShape = {
  type: string;
  vertices: Array<{ x: number; y: number }>;
  arrowHead?: { type: string; size: number };
  color?: string;
};
const asLeader = (e: unknown): LeaderShape => e as LeaderShape;

function leaderData(pairs: Array<[string, string]>, data: Record<string, string> = {}): EntityData {
  return { type: 'LEADER', layer: 'L1', data, pairs };
}

describe('convertLeader (ADR-635 Φάση B Batch 2 Part B)', () => {
  it('εξάγει ordered vertices από pairs — tip = vertices[0] (ΟΧΙ flat last-10/20)', () => {
    const e = asLeader(convertLeader(leaderData([
      ['10', '0'], ['20', '0'],
      ['10', '50'], ['20', '30'],
      ['10', '90'], ['20', '30'],
    ]), 0));
    expect(e.type).toBe('leader');
    expect(e.vertices).toEqual([{ x: 0, y: 0 }, { x: 50, y: 30 }, { x: 90, y: 30 }]);
  });

  it('arrowhead enabled by default (κανένα code 71) → closed + DIMASZ size', () => {
    const e = asLeader(convertLeader(leaderData([['10', '0'], ['20', '0'], ['10', '10'], ['20', '0']]), 1));
    expect(e.arrowHead).toEqual({ type: 'closed', size: DEFAULT_DIMSTYLE.dimasz });
  });

  it('code 71 = 0 (disabled) → arrowHead.type "none"', () => {
    const e = asLeader(convertLeader(
      leaderData([['10', '0'], ['20', '0'], ['10', '10'], ['20', '0']], { '71': '0' }),
      2,
    ));
    expect(e.arrowHead?.type).toBe('none');
  });

  it('εξάγει χρώμα από code 62 (ACI)', () => {
    const e = asLeader(convertLeader(
      leaderData([['10', '0'], ['20', '0'], ['10', '10'], ['20', '0']], { '62': '1' }),
      3,
    ));
    expect(e.color).toBeDefined();
  });

  it('επιστρέφει null όταν <2 vertices (ελλιπές LEADER)', () => {
    expect(convertLeader(leaderData([['10', '0'], ['20', '0']]), 4)).toBeNull();
    expect(convertLeader(leaderData([]), 5)).toBeNull();
  });
});
