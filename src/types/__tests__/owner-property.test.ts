/**
 * @fileoverview **Τα invariants της προσφοράς** — η ίδια συνάρτηση που φρουρεί την πύλη.
 * @related ADR-777 §7 (Α14 · Α20 · Α22) · §25.6 · types/owner-property.ts
 */

import {
  isLiveOwnerProperty,
  isOwnerPropertyLifecycle,
  newOwnerProperty,
  ownerPropertyInvariantViolations,
  ownerPropertyOfferKinds,
  OWNER_PROPERTY_INVARIANTS,
} from '../owner-property';
import {
  offerOf,
  validDraft,
  validOwnerProperty,
} from '@/lib/owner-property/__tests__/owner-property-fixtures';

describe('ownerPropertyInvariantViolations — ΟΛΕΣ, ποτέ η πρώτη', () => {
  it('Κ1 — ένα πλήρες προσχέδιο δεν παραβιάζει τίποτα (ο παρονομαστής)', () => {
    expect(ownerPropertyInvariantViolations(validDraft())).toEqual([]);
  });

  it('Κ2 — καμία ζωντανή διάθεση ⇒ `no-live-offer`', () => {
    expect(ownerPropertyInvariantViolations(validDraft({ offers: [] }))).toContain(
      'no-live-offer',
    );
  });

  it('Κ3 — ΑΠΟΣΥΡΜΕΝΗ μόνο διάθεση μετράει ως καμία ζωντανή', () => {
    const draft = validDraft({ offers: [offerOf('sell', 1, 'withdrawn')] });
    expect(ownerPropertyInvariantViolations(draft)).toContain('no-live-offer');
  });

  it('Κ4 — δύο ζωντανές ίδιου είδους ⇒ `duplicate-offer-kind` (Α20 §5)', () => {
    const draft = validDraft({
      offers: [offerOf('sell', 1, 'active', 'offr_a'), offerOf('sell', 2, 'active', 'offr_b')],
    });
    expect(ownerPropertyInvariantViolations(draft)).toContain('duplicate-offer-kind');
  });

  it('Κ5 — πώληση χωρίς τιμή ⇒ `offer-amount-missing` (Α22)', () => {
    const draft = validDraft({ offers: [offerOf('sell', null)] });
    expect(ownerPropertyInvariantViolations(draft)).toContain('offer-amount-missing');
  });

  it('🔴 Κ6 — ΑΝΤΙΠΑΡΟΧΗ χωρίς ποσοστό ⇒ επίσης `offer-amount-missing`', () => {
    // Το κενό που το παλιό λεξιλόγιο **δεν μπορούσε να δει**: το `exchange`
    // προβάλλεται σε `unavailable`, που δεν ζητά καμία τιμή.
    const draft = validDraft({ offers: [offerOf('exchange', null)] });
    expect(ownerPropertyInvariantViolations(draft)).toContain('offer-amount-missing');
  });

  it('Κ7 — ποσοστό εκτός εύρους ⇒ ΞΕΧΩΡΙΣΤΟΣ κωδικός (άλλη θεραπεία)', () => {
    const draft = validDraft({ offers: [offerOf('exchange', 250)] });
    const found = ownerPropertyInvariantViolations(draft);
    expect(found).toContain('exchange-percentage-out-of-range');
    expect(found).not.toContain('offer-amount-missing');
  });

  it('Κ8 — τα τρία βασικά πεδία του §25.6 κρίνονται ονομαστικά', () => {
    expect(ownerPropertyInvariantViolations(validDraft({ type: '' }))).toContain(
      'type-missing',
    );
    expect(ownerPropertyInvariantViolations(validDraft({ areaSqm: null }))).toContain(
      'area-not-positive',
    );
    expect(ownerPropertyInvariantViolations(validDraft({ areaSqm: 0 }))).toContain(
      'area-not-positive',
    );
    expect(ownerPropertyInvariantViolations(validDraft({ title: '   ' }))).toContain(
      'title-missing',
    );
  });

  it('🔑 Κ9 — το `0` είναι ΥΠΑΡΚΤΗ τιμή σε όροφο και υπνοδωμάτια', () => {
    // Ισόγειο + γκαρσονιέρα: **δεν** είναι «κενό».
    expect(ownerPropertyInvariantViolations(validDraft({ floor: 0, bedrooms: 0 }))).toEqual(
      [],
    );
    expect(ownerPropertyInvariantViolations(validDraft({ bedrooms: -1 }))).toContain(
      'bedrooms-negative',
    );
  });

  it('🔑 Κ10 — αρνητικός ΟΡΟΦΟΣ είναι νόμιμος (υπόγειο) — κανένας κωδικός', () => {
    expect(ownerPropertyInvariantViolations(validDraft({ floor: -1 }))).toEqual([]);
  });

  it('🔴 Κ11 — επιστρέφονται ΟΛΕΣ μαζί, ποτέ η πρώτη (Α14 §17.2)', () => {
    const found = ownerPropertyInvariantViolations(
      validDraft({ offers: [], type: '', areaSqm: null, title: '' }),
    );
    expect(found).toEqual(
      expect.arrayContaining([
        'no-live-offer',
        'type-missing',
        'area-not-positive',
        'title-missing',
      ]),
    );
    expect(found.length).toBeGreaterThanOrEqual(4);
  });

  it('Κ12 — κάθε κωδικός του κλειστού συνόλου είναι ΠΑΡΑΓΩΓΙΜΟΣ (κανείς αδρανής φρουρός)', () => {
    // ADR-749 §5: ένας κωδικός που καμία είσοδος δεν παράγει είναι φρουρός χωρίς
    // απόδειξη ζωής. Εδώ κατασκευάζεται ρητά είσοδος για **κάθε** έναν.
    const produced = new Set<string>([
      ...ownerPropertyInvariantViolations(validDraft({ offers: [] })),
      ...ownerPropertyInvariantViolations(
        validDraft({
          offers: [offerOf('sell', 1, 'active', 'a'), offerOf('sell', 2, 'active', 'b')],
        }),
      ),
      ...ownerPropertyInvariantViolations(validDraft({ offers: [offerOf('sell', null)] })),
      ...ownerPropertyInvariantViolations(validDraft({ offers: [offerOf('exchange', 250)] })),
      ...ownerPropertyInvariantViolations(validDraft({ type: '' })),
      ...ownerPropertyInvariantViolations(validDraft({ areaSqm: null })),
      ...ownerPropertyInvariantViolations(validDraft({ title: '' })),
      ...ownerPropertyInvariantViolations(validDraft({ bedrooms: -3 })),
    ]);

    for (const code of OWNER_PROPERTY_INVARIANTS) {
      expect(produced.has(code)).toBe(true);
    }
  });
});

describe('newOwnerProperty — τα γεγονότα του συστήματος, σε ένα σημείο', () => {
  it('Κ13 — γεννιέται `listed`: καμία ουρά έγκρισης (απόφαση Giorgio 2026-08-11)', () => {
    const property = newOwnerProperty(validDraft(), {
      id: 'ownp_x',
      ownerUserId: 'user-9',
    });
    expect(property.lifecycle).toBe('listed');
    expect(property.id).toBe('ownp_x');
    expect(property.ownerUserId).toBe('user-9');
    expect(property.createdAt).toBe(property.updatedAt);
  });
});

describe('βοηθητικά κατηγορήματα', () => {
  it('Κ14 — `isLiveOwnerProperty` ⇔ `listed`', () => {
    expect(isLiveOwnerProperty(validOwnerProperty())).toBe(true);
    expect(isLiveOwnerProperty(validOwnerProperty({ lifecycle: 'withdrawn' }))).toBe(false);
  });

  it('Κ15 — `isOwnerPropertyLifecycle` δέχεται μόνο το κλειστό σύνολο', () => {
    expect(isOwnerPropertyLifecycle('listed')).toBe(true);
    expect(isOwnerPropertyLifecycle('withdrawn')).toBe(true);
    expect(isOwnerPropertyLifecycle('draft')).toBe(false);
    expect(isOwnerPropertyLifecycle(null)).toBe(false);
  });

  it('Κ16 — τα είδη επιστρέφονται ΤΑΞΙΝΟΜΗΜΕΝΑ και χωρίς διπλά', () => {
    const property = validOwnerProperty({
      offers: [
        offerOf('leaseOut', 800, 'active', 'offr_l'),
        offerOf('sell', 1, 'active', 'offr_s'),
        offerOf('exchange', 40, 'withdrawn', 'offr_e'),
      ],
    });
    expect(ownerPropertyOfferKinds(property)).toEqual(['leaseOut', 'sell']);
  });
});
