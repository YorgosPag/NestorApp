/**
 * ADR-888 — η μετάπτωση `area.outline` → `area.shapes`: ιδεμποτική, γράφει μόνο το `place`, αναφέρει συγκρούσεις.
 */

import { planAreaShapes } from '../migrate-demand-area-shapes';

const OUTLINE = [
  { lat: 40.63, lng: 22.93 },
  { lat: 40.63, lng: 22.95 },
  { lat: 40.65, lng: 22.95 },
];

describe('planAreaShapes', () => {
  it('παλιό `outline` → εγγραφή `shapes:[{ring}]` (μορφή εγγράφου: Firestore χωρίς πίνακα-σε-πίνακα)', () => {
    expect(planAreaShapes({ place: { kind: 'area', outline: OUTLINE } })).toEqual({
      kind: 'write',
      place: { kind: 'area', shapes: [{ ring: OUTLINE }] },
    });
  });

  it('ιδεμποτική: ήδη νέο σχήμα ⇒ καμία εγγραφή', () => {
    expect(planAreaShapes({ place: { kind: 'area', shapes: [{ ring: OUTLINE }] } })).toEqual({ kind: 'noop' });
  });

  it('άλλες μορφές τόπου και απόν `place` ⇒ καμία εγγραφή', () => {
    expect(planAreaShapes({ place: { kind: 'anywhere' } })).toEqual({ kind: 'noop' });
    expect(planAreaShapes({})).toEqual({ kind: 'noop' });
  });

  it('`outline` ΚΑΙ `shapes` μαζί ⇒ σύγκρουση, ποτέ εγγραφή', () => {
    expect(planAreaShapes({ place: { kind: 'area', outline: OUTLINE, shapes: [OUTLINE] } })).toEqual({
      kind: 'conflict',
    });
  });
});
