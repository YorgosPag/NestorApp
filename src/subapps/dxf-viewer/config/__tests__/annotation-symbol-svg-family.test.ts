/**
 * ADR-608 Φ-import-svg — tests για το SVG-based σύμβολο `personFamily` (πρωτότυπο σχέδιο
 * χρήστη) + την ταυτοποίησή του από type_res 52 («Άνθρωποι 1» του Τέκτονα).
 */

import { getAnnotationSymbol } from '../annotation-symbol-catalog';
import { tekSymbolFromTypeRes } from '../../export/core/tek/tek-symbol-catalog';
import { FAMILY_GLYPH } from '../annotation-symbol-svg/family-glyph';

describe('personFamily — SVG glyph σύμβολο', () => {
  it('υπάρχει στον κατάλογο με kind person + svg geometry', () => {
    const def = getAnnotationSymbol('personFamily');
    expect(def.id).toBe('personFamily'); // ΟΧΙ fallback
    expect(def.kind).toBe('person');
    expect(def.geometry).toHaveLength(1);
    const g = def.geometry[0];
    expect(g.kind).toBe('svg');
    if (g.kind === 'svg') {
      expect(g.viewBox).toEqual([0, 0, 676, 863]);
      expect(g.elements.length).toBeGreaterThan(10);
    }
  });

  it('το FAMILY_GLYPH έχει έγκυρα elements (paths/circles, μη-κενά d)', () => {
    const paths = FAMILY_GLYPH.elements.filter((e) => e.el === 'path');
    const circles = FAMILY_GLYPH.elements.filter((e) => e.el === 'circle');
    expect(paths.length).toBeGreaterThan(10);
    expect(circles.length).toBe(4); // 4 κουμπιά (fill)
    for (const p of paths) if (p.el === 'path') expect(p.d.length).toBeGreaterThan(0);
  });

  it('type_res 52 (Άνθρωποι 1) → personFamily / person', () => {
    const m = tekSymbolFromTypeRes(52);
    expect(m).toEqual({ symbolId: 'personFamily', kind: 'person' });
  });
});
