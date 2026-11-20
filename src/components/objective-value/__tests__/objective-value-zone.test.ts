/**
 * ADR-898 Φ2 — ποια τιμή ζώνης μπαίνει στον υπολογισμό: ζώνη · ΔΗΛΩΜΕΝΟ μέτωπο · χειροκίνητη μόνο χωρίς ζώνη.
 * ADR-898 Φ5 — και ο ΣΕ της πηγής πάει ΜΑΖΙ με την τιμή που επιλέχθηκε.
 */

import type { ValueZoneLookup } from '@/hooks/market/useValueZoneAt';

import { frontKeyOf } from '@/lib/objective-value/objective-value-zone';

import { chosenZone } from '../objective-value-zone';

const FRONT = { id: 'f1', name: 'Μ1', price: 4200, validFrom: '2022-01-01', commerciality: { kind: 'factor' as const, value: 1.4 }, street: 'Εγνατίας', distanceM: 12 };

const READY: ValueZoneLookup = {
  kind: 'answered',
  verdict: {
    kind: 'ready',
    zone: { id: 'z1', name: 'ΚΣΤ', price: 3600, validFrom: '2022-01-01', commerciality: { kind: 'factor' as const, value: 1 } },
    nearEdge: false,
    fronts: [FRONT],
  },
};

const priceOf = (...args: Parameters<typeof chosenZone>) => chosenZone(...args)?.price ?? null;

describe('chosenZone', () => {
  it('ζώνη χωρίς δηλωμένο μέτωπο ⇒ η τιμή της ζώνης (η θέση δεν αποδεικνύει πρόσοψη), με τον ΣΕ της ζώνης', () => {
    expect(chosenZone(READY, null, null)).toEqual({ price: 3600, commerciality: { kind: 'factor', value: 1 } });
  });

  it('δηλωμένη πρόσοψη στο μέτωπο ⇒ η τιμή του μετώπου, με τον ΣΕ του μετώπου', () => {
    expect(chosenZone(READY, frontKeyOf(FRONT), null)).toEqual({ price: 4200, commerciality: { kind: 'factor', value: 1.4 } });
  });

  it('μέτωπο που δεν υπάρχει πια (νέα θέση) ⇒ πίσω στη ζώνη, ποτέ σε ξένη τιμή', () => {
    expect(priceOf(READY, 'gone|Αλλού', null)).toBe(3600);
  });

  it('με έτοιμη ζώνη η χειροκίνητη τιμή αγνοείται — δεν υπερισχύει σιωπηλά του χάρτη', () => {
    expect(priceOf(READY, null, 9999)).toBe(3600);
  });

  it.each<ValueZoneLookup>([
    { kind: 'idle' },
    { kind: 'failed' },
    { kind: 'answered', verdict: { kind: 'outside' } },
  ])('χωρίς ζώνη (%o) ⇒ η χειροκίνητη, με ΣΕ άγνωστο (ο άνθρωπος ρωτιέται)', (lookup) => {
    expect(chosenZone(lookup, null, 2100)).toEqual({ price: 2100, commerciality: { kind: 'unknown' } });
    expect(chosenZone(lookup, null, null)).toBeNull();
  });

  it('όσο φορτώνει ⇒ ούτε ζώνη ούτε χειροκίνητη ζώνη ακόμη, μόνο ό,τι έγραψε ο άνθρωπος', () => {
    expect(chosenZone({ kind: 'loading' }, null, null)).toBeNull();
  });
});
