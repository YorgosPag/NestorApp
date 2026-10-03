/**
 * ⚓ ADR-900 §8 #2 (2β.2) — οι στάθμες που δηλώνει ο ιδιοκτήτης + το ΕΝΑ κλειδί `αριθμός:είδος`.
 */

import { declaredFloorOptions, DECLARED_FLOOR_MAX } from '../declared-floor-options';
import { floorRefKey, parseFloorRefKey, type FloorRef } from '../floor-ref';

describe('floorRefKey ⇄ parseFloorRefKey', () => {
  it.each<FloorRef>([
    { number: 0, kind: 'pilotis' },
    { number: -2, kind: 'basement' },
    { number: 3, kind: 'standard' },
    { number: null, kind: 'roof' },
  ])('στρογγυλή διαδρομή %p', (ref) => {
    expect(parseFloorRefKey(floorRefKey(ref))).toEqual(ref);
  });

  it('το είδος επιλύεται: {0, null} ≡ {0, ground}', () => {
    expect(floorRefKey({ number: 0, kind: null })).toBe(floorRefKey({ number: 0, kind: 'ground' }));
  });

  it.each(['', '3', '3:nope', 'x:standard', ':standard', '1.5:standard'])('άκυρο κλειδί %p ⇒ null', (key) => {
    expect(parseFloorRefKey(key)).toBeNull();
  });
});

describe('declaredFloorOptions', () => {
  const values = declaredFloorOptions().map((o) => o.value);

  it('ΕΝΑ dropdown: υπόγεια · ημιυπόγειο · ισόγειο/υπερυψωμένο/πυλωτή/ημιώροφος · όροφοι — κατά στάθμη', () => {
    expect(values.slice(0, 8)).toEqual([
      '-3:basement', '-2:basement', '-1:basement', '-1:semi-basement',
      '0:ground', '0:raised-ground', '0:pilotis', '0:mezzanine',
    ]);
    expect(values.at(-1)).toBe(`${DECLARED_FLOOR_MAX}:standard`);
    expect(new Set(values).size).toBe(values.length);
  });

  it('🔑 κάθε επιλογή έχει αριθμό (η ζήτηση ταιριάζει σε εύρος)', () => {
    expect(declaredFloorOptions().every((o) => o.ref.number !== null)).toBe(true);
  });

  it('η αποθηκευμένη τιμή εκτός λίστας ΕΜΦΑΝΙΖΕΤΑΙ (αλλιώς η επεξεργασία θα την έσβηνε σιωπηλά)', () => {
    const high = declaredFloorOptions({ number: 42, kind: 'standard' }).map((o) => o.value);
    expect(high).toContain('42:standard');
    expect(high.at(-1)).toBe('42:standard');
    expect(declaredFloorOptions({ number: 2, kind: 'standard' })).toHaveLength(values.length);
  });
});
