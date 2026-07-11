/**
 * ADR-637 Phase 4-B — pure `StairRestLandingsSection` array-op helpers.
 * Guards: (1) deterministic `stln_N` id generation (max existing + 1, no
 * collisions); (2) append seeds `at:0.5`, `length:'auto'`; (3) remove-by-id
 * only drops the matching landing; (4) patch-by-id is an immutable merge.
 */

import {
  nextRestLandingId,
  appendRestLanding,
  removeRestLandingById,
  patchRestLandingById,
} from '../stair-rest-landing-helpers';
import type { StairRestLanding } from '../../../../bim/types/stair-types';

describe('stair-rest-landing-helpers — ADR-637 Phase 4-B', () => {
  describe('nextRestLandingId', () => {
    it('returns stln_1 for an empty list', () => {
      expect(nextRestLandingId([])).toBe('stln_1');
    });

    it('returns max existing suffix + 1', () => {
      const existing: StairRestLanding[] = [
        { id: 'stln_1', at: 0.3, length: 'auto' },
        { id: 'stln_3', at: 0.7, length: 'auto' },
      ];
      expect(nextRestLandingId(existing)).toBe('stln_4');
    });

    it('ignores ids outside the stln_ scheme', () => {
      const existing: StairRestLanding[] = [{ id: 'imported-id', at: 0.5, length: 'auto' }];
      expect(nextRestLandingId(existing)).toBe('stln_1');
    });
  });

  describe('appendRestLanding', () => {
    it('appends a landing at the midpoint with auto length', () => {
      const next = appendRestLanding([]);
      expect(next).toHaveLength(1);
      expect(next[0]).toEqual({ id: 'stln_1', at: 0.5, length: 'auto' });
    });

    it('does not mutate the source array', () => {
      const source: StairRestLanding[] = [{ id: 'stln_1', at: 0.5, length: 'auto' }];
      const next = appendRestLanding(source);
      expect(source).toHaveLength(1);
      expect(next).toHaveLength(2);
    });
  });

  describe('removeRestLandingById', () => {
    it('removes only the matching landing', () => {
      const source: StairRestLanding[] = [
        { id: 'stln_1', at: 0.3, length: 'auto' },
        { id: 'stln_2', at: 0.7, length: 'auto' },
      ];
      expect(removeRestLandingById(source, 'stln_1')).toEqual([
        { id: 'stln_2', at: 0.7, length: 'auto' },
      ]);
    });

    it('is a no-op when the id is not found', () => {
      const source: StairRestLanding[] = [{ id: 'stln_1', at: 0.3, length: 'auto' }];
      expect(removeRestLandingById(source, 'missing')).toEqual(source);
    });
  });

  describe('patchRestLandingById', () => {
    it('merges the patch into the matching landing only', () => {
      const source: StairRestLanding[] = [
        { id: 'stln_1', at: 0.3, length: 'auto' },
        { id: 'stln_2', at: 0.7, length: 'auto' },
      ];
      const next = patchRestLandingById(source, 'stln_2', { length: 1800, depth: 900 });
      expect(next).toEqual([
        { id: 'stln_1', at: 0.3, length: 'auto' },
        { id: 'stln_2', at: 0.7, length: 1800, depth: 900 },
      ]);
    });
  });
});
