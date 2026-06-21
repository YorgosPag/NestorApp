/**
 * ADR-507 Φ2 — hatch pattern thumbnail generator tests.
 *
 * Επιβεβαιώνει: (1) τα line μοτίβα παράγουν >0 τμήματα entro στο viewBox·
 * (2) reuse του SSoT geometry· (3) empty-safe για άγνωστο όνομα·
 * (4) memoization (ίδιο reference).
 */

import {
  buildHatchPatternThumbnail,
  DEFAULT_THUMBNAIL_SIZE,
} from '../hatch-pattern-thumbnail';
import { listHatchPatterns } from '../../../data/hatch-pattern-catalog';

describe('buildHatchPatternThumbnail', () => {
  it('παράγει τμήματα για αντιπροσωπευτικά line μοτίβα', () => {
    for (const name of ['ANSI31', 'BRICK', 'NET']) {
      const thumb = buildHatchPatternThumbnail(name);
      expect(thumb.size).toBe(DEFAULT_THUMBNAIL_SIZE);
      expect(thumb.lines.length).toBeGreaterThan(0);
    }
  });

  it('κρατά όλα τα τμήματα εντός του viewBox (0..size)', () => {
    const size = 50;
    const thumb = buildHatchPatternThumbnail('ANSI31', size);
    for (const l of thumb.lines) {
      for (const v of [l.x1, l.y1, l.x2, l.y2]) {
        expect(v).toBeGreaterThanOrEqual(-0.01);
        expect(v).toBeLessThanOrEqual(size + 0.01);
      }
    }
  });

  it('είναι empty-safe για άγνωστο όνομα μοτίβου', () => {
    const thumb = buildHatchPatternThumbnail('__does-not-exist__');
    expect(thumb.lines).toEqual([]);
    expect(thumb.size).toBe(DEFAULT_THUMBNAIL_SIZE);
  });

  it('επιστρέφει memoized (ίδιο reference) για ίδιο name|size', () => {
    const a = buildHatchPatternThumbnail('BRICK', 40);
    const b = buildHatchPatternThumbnail('BRICK', 40);
    expect(a).toBe(b);
  });

  it('κάθε καταχωρημένο μοτίβο παράγει thumbnail χωρίς σφάλμα', () => {
    for (const p of listHatchPatterns()) {
      const thumb = buildHatchPatternThumbnail(p.name);
      expect(Array.isArray(thumb.lines)).toBe(true);
    }
  });
});
