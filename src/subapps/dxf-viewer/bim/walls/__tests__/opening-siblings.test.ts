/**
 * ADR-363 Φ1G.5 Slice 2f — getSiblingOpeningsOnWall (pure filter+sort SSoT).
 */

import { getSiblingOpeningsOnWall } from '../opening-siblings';
import type { OpeningEntity } from '../../types/opening-types';

const mk = (id: string, wallId: string, offset: number): OpeningEntity =>
  ({ id, params: { wallId, offsetFromStart: offset } }) as unknown as OpeningEntity;

describe('getSiblingOpeningsOnWall', () => {
  it('keeps only openings on the host wall and excludes the dragged opening', () => {
    const all = [mk('a', 'w1', 0), mk('drag', 'w1', 500), mk('c', 'w2', 100)];
    const res = getSiblingOpeningsOnWall('w1', all, 'drag');
    expect(res.map((o) => o.id)).toEqual(['a']);
  });

  it('sorts ascending by offsetFromStart', () => {
    const all = [mk('a', 'w1', 900), mk('b', 'w1', 100), mk('c', 'w1', 500)];
    const res = getSiblingOpeningsOnWall('w1', all, 'none');
    expect(res.map((o) => o.id)).toEqual(['b', 'c', 'a']);
  });

  it('returns empty when the wall has no other openings', () => {
    expect(getSiblingOpeningsOnWall('w1', [mk('drag', 'w1', 0)], 'drag')).toEqual([]);
  });
});
