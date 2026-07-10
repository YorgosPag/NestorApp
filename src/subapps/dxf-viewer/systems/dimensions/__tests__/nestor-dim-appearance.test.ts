/**
 * ADR-608 — lock the «Nestor dimension appearance» SSoT: app-created dims (NESTOR_DEFAULT_TEMPLATE)
 * and Tekton-imported dims share the SAME structural style values. Guards against future drift
 * (Giorgio 2026-07-10: «να έρθουν πιο κοντά οι διαστάσεις της εφαρμογής στις διαστάσεις του Τέκτονα»).
 */

import {
  NESTOR_DIM_ANNOTATION_SCALE,
  NESTOR_DIM_TEXT_HEIGHT,
  NESTOR_DIM_ARROW_SIZE,
  NESTOR_DIM_ARROW_BLOCK,
  NESTOR_DIM_TEXT_PLACEMENT,
  NESTOR_DIM_TEXT_FILL,
} from '../nestor-dim-appearance';
import { NESTOR_DEFAULT_TEMPLATE } from '../dim-style-templates';

describe('Nestor dimension appearance SSoT', () => {
  it('το default style «ΔΙΑΣΤΑΣΕΙΣ Nestor» χρησιμοποιεί ΤΙΣ ΙΔΙΕΣ δομικές τιμές με την SSoT', () => {
    expect(NESTOR_DEFAULT_TEMPLATE.dimscale).toBe(NESTOR_DIM_ANNOTATION_SCALE);
    expect(NESTOR_DEFAULT_TEMPLATE.dimtxt).toBe(NESTOR_DIM_TEXT_HEIGHT);
    expect(NESTOR_DEFAULT_TEMPLATE.dimasz).toBe(NESTOR_DIM_ARROW_SIZE);
    expect(NESTOR_DEFAULT_TEMPLATE.dimblk).toBe(NESTOR_DIM_ARROW_BLOCK);
    expect(NESTOR_DEFAULT_TEMPLATE.dimtad).toBe(NESTOR_DIM_TEXT_PLACEMENT);
    expect(NESTOR_DEFAULT_TEMPLATE.dimtfill).toBe(NESTOR_DIM_TEXT_FILL);
  });

  it('η πράσινη ταυτότητα Nestor ΔΙΑΤΗΡΕΙΤΑΙ (μόνο το χρώμα διαφέρει από το Τέκτονα)', () => {
    expect(NESTOR_DEFAULT_TEMPLATE.dimclrdTrueColor).toBe(0x008000);
    expect(NESTOR_DEFAULT_TEMPLATE.dimclrtTrueColor).toBe(0x008000);
  });
});
