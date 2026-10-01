/**
 * ADR-898 Φ2 — ποια τιμή ζώνης μπαίνει στον υπολογισμό: ζώνη · ΔΗΛΩΜΕΝΟ μέτωπο · χειροκίνητη μόνο χωρίς ζώνη.
 */

import type { ValueZoneLookup } from '@/hooks/market/useValueZoneAt';

import { frontKeyOf } from '@/lib/objective-value/objective-value-zone';

import { chosenZonePrice } from '../objective-value-zone';

const FRONT = { id: 'f1', name: 'Μ1', price: 4200, validFrom: '2022-01-01', street: 'Εγνατίας', distanceM: 12 };

const READY: ValueZoneLookup = {
  kind: 'answered',
  verdict: {
    kind: 'ready',
    zone: { id: 'z1', name: 'ΚΣΤ', price: 3600, validFrom: '2022-01-01' },
    nearEdge: false,
    fronts: [FRONT],
  },
};

describe('chosenZonePrice', () => {
  it('ζώνη χωρίς δηλωμένο μέτωπο ⇒ η τιμή της ζώνης (η θέση δεν αποδεικνύει πρόσοψη)', () => {
    expect(chosenZonePrice(READY, null, null)).toBe(3600);
  });

  it('δηλωμένη πρόσοψη στο μέτωπο ⇒ η τιμή του μετώπου', () => {
    expect(chosenZonePrice(READY, frontKeyOf(FRONT), null)).toBe(4200);
  });

  it('μέτωπο που δεν υπάρχει πια (νέα θέση) ⇒ πίσω στη ζώνη, ποτέ σε ξένη τιμή', () => {
    expect(chosenZonePrice(READY, 'gone|Αλλού', null)).toBe(3600);
  });

  it('με έτοιμη ζώνη η χειροκίνητη τιμή αγνοείται — δεν υπερισχύει σιωπηλά του χάρτη', () => {
    expect(chosenZonePrice(READY, null, 9999)).toBe(3600);
  });

  it.each<ValueZoneLookup>([
    { kind: 'idle' },
    { kind: 'failed' },
    { kind: 'answered', verdict: { kind: 'outside' } },
  ])('χωρίς ζώνη (%o) ⇒ η χειροκίνητη', (lookup) => {
    expect(chosenZonePrice(lookup, null, 2100)).toBe(2100);
    expect(chosenZonePrice(lookup, null, null)).toBeNull();
  });

  it('όσο φορτώνει ⇒ ούτε ζώνη ούτε χειροκίνητη ζώνη ακόμη, μόνο ό,τι έγραψε ο άνθρωπος', () => {
    expect(chosenZonePrice({ kind: 'loading' }, null, null)).toBeNull();
  });
});
