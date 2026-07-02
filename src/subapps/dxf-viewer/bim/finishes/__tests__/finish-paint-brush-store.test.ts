/**
 * ADR-449 PART B Slice C (2D) — tests για το `finish-paint-brush-store`.
 *
 * Καλύπτει: default πινέλο (εσωτερικός σοβάς)· setBrush υλικό/χρώμα/null· getter snapshot.
 */

import {
  useFinishPaintBrushStore,
  getFinishPaintBrush,
} from '../finish-paint-brush-store';
import { STRUCTURAL_FINISH_INTERIOR_MATERIAL } from '../structural-finish-types';

describe('finish-paint-brush-store (ADR-449 Slice C 2D)', () => {
  afterEach(() => {
    // Reset στο default μεταξύ tests (singleton store).
    useFinishPaintBrushStore.getState().setBrush({ materialId: STRUCTURAL_FINISH_INTERIOR_MATERIAL });
  });

  it('default πινέλο = εσωτερικός σοβάς (πρώτο swatch)', () => {
    expect(getFinishPaintBrush()).toEqual({ materialId: STRUCTURAL_FINISH_INTERIOR_MATERIAL });
  });

  it('setBrush υλικό → getter επιστρέφει το υλικό', () => {
    useFinishPaintBrushStore.getState().setBrush({ materialId: 'mat-plaster-ext' });
    expect(getFinishPaintBrush()).toEqual({ materialId: 'mat-plaster-ext' });
  });

  it('setBrush custom χρώμα → colorOverride', () => {
    useFinishPaintBrushStore.getState().setBrush({ colorOverride: '#C0392B' });
    expect(getFinishPaintBrush()).toEqual({ colorOverride: '#C0392B' });
  });

  it('setBrush(null) → σβήσιμο (eraser)', () => {
    useFinishPaintBrushStore.getState().setBrush(null);
    expect(getFinishPaintBrush()).toBeNull();
  });
});
