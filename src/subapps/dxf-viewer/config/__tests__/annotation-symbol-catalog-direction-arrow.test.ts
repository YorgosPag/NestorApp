/**
 * ADR-608 Φ-import-glyphs — tests για τα νέα direction-arrow σύμβολα (δικά μας «πιστά»
 * σχέδια για ταύτιση με native σύμβολα Τέκτονα κατά το import). Επιβεβαιώνει ότι κάθε νέο
 * σύμβολο υπάρχει στον κατάλογο (ΟΧΙ fallback), έχει σωστό kind + μη-κενή γεωμετρία.
 */

import {
  getAnnotationSymbol,
  listAnnotationSymbolsByKind,
} from '../annotation-symbol-catalog';

const DIRECTION_ARROW_IDS = [
  'directionArrowSingle',
  'directionArrowDouble',
  'directionArrowOutline',
  'entranceArrow',
] as const;

describe('ADR-608 — direction-arrow catalog σύμβολα', () => {
  it.each(DIRECTION_ARROW_IDS)('%s υπάρχει (ΟΧΙ fallback) με kind + γεωμετρία', (id) => {
    const def = getAnnotationSymbol(id);
    expect(def.id).toBe(id); // fallback θα επέστρεφε 'northArrowSimple'
    expect(def.kind).toBe('direction-arrow');
    expect(def.geometry.length).toBeGreaterThan(0);
    expect(def.labelKey.startsWith('annotationSymbol.directionArrow.')).toBe(true);
  });

  it('listAnnotationSymbolsByKind("direction-arrow") επιστρέφει και τα 4', () => {
    const ids = listAnnotationSymbolsByKind('direction-arrow').map((d) => d.id).sort();
    expect(ids).toEqual([...DIRECTION_ARROW_IDS].sort());
  });
});
