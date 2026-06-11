/**
 * ADR-441 Slice 5a-grid — `gridStripJustification` rule tests.
 *
 * Pure rule: περιμετρικές λωρίδες → inward· εσωτερικές → center. Σήμανση επιβεβαιωμένη
 * ως προς τον CCW normal του `buildBandFootprint` (αριστερότερη V → 'right' = +X inward).
 */

import { gridStripJustification } from '../foundation-grid-justification';

describe('gridStripJustification', () => {
  describe('κατακόρυφες (V)', () => {
    it('αριστερότερη (index 0) → right (inward +X)', () => {
      expect(gridStripJustification('V', 0, 3)).toBe('right');
    });
    it('δεξιότερη (last) → left (inward −X)', () => {
      expect(gridStripJustification('V', 2, 3)).toBe('left');
    });
    it('εσωτερική → center', () => {
      expect(gridStripJustification('V', 1, 3)).toBe('center');
    });
  });

  describe('οριζόντιες (H)', () => {
    it('κάτω (index 0) → left (inward +Y)', () => {
      expect(gridStripJustification('H', 0, 3)).toBe('left');
    });
    it('πάνω (last) → right (inward −Y)', () => {
      expect(gridStripJustification('H', 2, 3)).toBe('right');
    });
    it('εσωτερική → center', () => {
      expect(gridStripJustification('H', 1, 3)).toBe('center');
    });
  });

  describe('μεγαλύτεροι κάναβοι (πολλές εσωτερικές)', () => {
    it('5 άξονες → μόνο 0 & 4 περιμετρικοί, 1-3 center', () => {
      const verts = [0, 1, 2, 3, 4].map((i) => gridStripJustification('V', i, 5));
      expect(verts).toEqual(['right', 'center', 'center', 'center', 'left']);
    });
  });

  describe('2×2 (κάθε άξονας περιμετρικός)', () => {
    it('count=2 → index 0 & 1 και οι δύο inward (καμία center)', () => {
      expect(gridStripJustification('V', 0, 2)).toBe('right');
      expect(gridStripJustification('V', 1, 2)).toBe('left');
      expect(gridStripJustification('H', 0, 2)).toBe('left');
      expect(gridStripJustification('H', 1, 2)).toBe('right');
    });
  });
});
