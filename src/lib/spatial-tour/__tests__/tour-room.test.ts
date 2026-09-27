/**
 * @fileoverview **Ο ΧΩΡΟΣ ΕΝΟΣ ΣΗΜΕΙΟΥ** (ADR-884 Φ2στ · §4.12) — καθαρό.
 *
 * - **Κ** — κανονικοποίηση: μοναδικοί τύποι με τη σειρά τους · όνομα χωρίς κενά άκρων, κενό ⇒ `null` · άκυρα ⇒ `null`.
 * - **Ε** — εμφάνιση: όνομα πάνω από τύπο (Matterport) · αρίθμηση ΜΟΝΟ όταν ο ίδιος τύπος επαναλαμβάνεται στον όροφο.
 */

import { TOUR_ROOM_LABEL_MAX } from '@/constants/spatial-tour-vocabulary';
import type { TourNode, TourRoom } from '@/types/spatial-tour';

import { normalizeTourRoom, sameTourRoom, tourRoomDisplay } from '../tour-room';

const L0 = { kind: 'local', ordinal: 0 } as const;
const room = (types: TourRoom['types'], label: string | null = null): TourRoom => ({ types, label, source: 'manual' });
const node = (id: string, r: TourRoom | null = null): TourNode => ({ id, levelKey: L0, position: null, links: [], ...(r ? { room: r } : {}) });

describe('Κ — κανονικοποίηση', () => {
  it('μοναδικοί τύποι με τη σειρά τους · όνομα χωρίς κενά άκρων', () => {
    expect(normalizeTourRoom({ types: ['kitchen', 'living-room', 'kitchen'], label: '  Ενιαίος χώρος ' }))
      .toEqual(room(['kitchen', 'living-room'], 'Ενιαίος χώρος'));
  });

  it('κενό όνομα ⇒ null (ο τύπος μιλά)', () => {
    expect(normalizeTourRoom({ types: ['office'], label: '   ' })).toEqual(room(['office']));
  });

  it.each([
    ['άγνωστος τύπος', { types: ['throne-room'], label: null }],
    ['κανένας τύπος', { types: [], label: null }],
    ['πάνω από τρεις', { types: ['kitchen', 'living-room', 'dining-room', 'office'], label: null }],
    ['όνομα πολύ μακρύ', { types: ['office'], label: 'α'.repeat(TOUR_ROOM_LABEL_MAX + 1) }],
    ['όνομα όχι κείμενο', { types: ['office'], label: 42 }],
  ])('%s ⇒ null', (_label, input) => {
    expect(normalizeTourRoom(input)).toBeNull();
  });

  it('ίδιος χώρος — σειρά τύπων μετρά, απών = null', () => {
    expect(sameTourRoom(room(['office'], 'Γ'), room(['office'], 'Γ'))).toBe(true);
    expect(sameTourRoom(room(['office'], 'Γραφείο'), room(['office'], 'Γραφείο μηχανικού'))).toBe(false);
    expect(sameTourRoom(room(['kitchen', 'dining-room']), room(['dining-room', 'kitchen']))).toBe(false);
    expect(sameTourRoom(undefined, null)).toBe(true);
    expect(sameTourRoom(room(['office']), null)).toBe(false);
  });
});

describe('Ε — εμφάνιση', () => {
  it('χωρίς χώρο ⇒ null (ο καλών δείχνει «Σημείο N»)', () => {
    expect(tourRoomDisplay(node('a'), [node('a')])).toBeNull();
  });

  it('το όνομα υπερισχύει του τύπου', () => {
    const a = node('a', room(['office'], 'Γραφείο μηχανικού'));
    expect(tourRoomDisplay(a, [a])).toEqual({ kind: 'label', text: 'Γραφείο μηχανικού' });
  });

  it('μοναδικός τύπος στον όροφο ⇒ χωρίς αριθμό', () => {
    const a = node('a', room(['hallway']));
    expect(tourRoomDisplay(a, [a, node('b', room(['office']))])).toEqual({ kind: 'types', types: ['hallway'], ordinal: null });
  });

  it('επαναλαμβανόμενος τύπος ⇒ 1, 2 με τη σειρά των σημείων· όσα έχουν όνομα δεν μετρούν', () => {
    const a = node('a', room(['bedroom']));
    const named = node('n', room(['bedroom'], 'Master'));
    const b = node('b', room(['bedroom']));
    const level = [a, named, b];
    expect(tourRoomDisplay(a, level)).toEqual({ kind: 'types', types: ['bedroom'], ordinal: 1 });
    expect(tourRoomDisplay(b, level)).toEqual({ kind: 'types', types: ['bedroom'], ordinal: 2 });
  });
});
