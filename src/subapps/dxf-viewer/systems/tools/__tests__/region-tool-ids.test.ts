/**
 * ADR-419 / ADR-443 §wall-entry-split — Tests for the wall-tool predicate SSoT.
 *
 * Εστίαση στο `isWallDrawingTool`: μετά τη μεταφορά των εργαλείων τοίχου στο
 * contextual «Ιδιότητες τοίχου», το `'wall-on-entity'` ΠΡΕΠΕΙ να θεωρείται
 * εργαλείο σχεδίασης τοίχου — αλλιώς με το κλικ του μέσα στο tab ο contextual
 * trigger γινόταν null και το tab έκλεινε μόνο του (regression guard).
 */

import { isWallDrawingTool, isWallRegionTool } from '../region-tool-ids';

describe('isWallDrawingTool (ADR-443 §wall-entry-split)', () => {
  it('treats `wall-on-entity` as a wall drawing tool (keeps the contextual tab open)', () => {
    expect(isWallDrawingTool('wall-on-entity')).toBe(true);
  });

  it('covers every wall drawing tool that shares the contextual wall tab', () => {
    for (const tool of [
      'wall',
      'wall-on-entity',
      'wall-region-lines',
      'wall-region-inside',
      'wall-region-box',
      'wall-from-perimeter',
    ]) {
      expect(isWallDrawingTool(tool)).toBe(true);
    }
  });

  it('rejects non-wall tools and nullish input', () => {
    for (const tool of ['column', 'beam', 'slab', 'foundation-pad', 'select', '', null, undefined]) {
      expect(isWallDrawingTool(tool)).toBe(false);
    }
  });

  it('does NOT reclassify `wall-on-entity` as a region tool', () => {
    // wall-on-entity μοιράζεται το tab αλλά ΔΕΝ είναι region variant (δεν έχει method).
    expect(isWallRegionTool('wall-on-entity')).toBe(false);
  });
});
