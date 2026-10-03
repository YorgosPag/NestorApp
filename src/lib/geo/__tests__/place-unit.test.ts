/**
 * ⚓ ADR-900 §8 #2 (2β.2) — η ΜΟΝΑΔΑ ως σύνθεση (`PlaceRef` + στάθμη + πόρτα + ΚΑΕΚ) και το κλειδί της.
 *
 * - ΚΑΕΚ **μόνο** από `verified` απόδειξη και **μόνο** κωδικός ιδιοκτησίας (`/Κ/Ο`).
 * - Κλειδί: ΚΑΕΚ κερδίζει (UPRN-παιδί)· αλλιώς κτίριο + στάθμη + σκελετός πόρτας (UTS #39).
 * - Ελλιπής μονάδα ⇒ `null` — καμία ψευδο-μονάδα.
 */

import { composePlaceUnitRef, unitKaekOf, type PlaceUnitDeclaration, type PlaceUnitRef } from '../place-unit';
import { placeUnitKey } from '../place-unit-key.server';
import { OWNERSHIP_VERIFICATION_STATUSES } from '@/types/ownership-verification';

const LINK = { landId: 'land_1', buildingId: 'pbld_1' } as const;
const UNIT_KAEK = '050681726003/0/1';

function declaration(over: Partial<PlaceUnitDeclaration> = {}): PlaceUnitDeclaration {
  return {
    place: { kind: 'declared', link: LINK },
    floor: 2,
    floorKind: 'standard',
    unitNumber: 'Α1',
    ...over,
  };
}

function unit(over: Partial<PlaceUnitRef> = {}): PlaceUnitRef {
  return { ...LINK, floor: { number: 2, kind: 'standard' }, unitNumber: 'Α1', kaek: null, ...over };
}

describe('composePlaceUnitRef', () => {
  it('συνθέτει τον τόπο Α με στάθμη και πόρτα — ο PlaceRef μένει αυτούσιος', () => {
    expect(composePlaceUnitRef(declaration(), null)).toEqual(unit());
  });

  it('χωρίς δεσμό προς το επίπεδο Α (ή με άρνηση θέσης) ⇒ καμία μονάδα', () => {
    expect(composePlaceUnitRef(declaration({ place: { kind: 'declared', link: null } }), null)).toBeNull();
    expect(composePlaceUnitRef(declaration({ place: { kind: 'declined' } }), null)).toBeNull();
  });

  it('πυλωτή ≠ ισόγειο στη στάθμη της μονάδας', () => {
    expect(composePlaceUnitRef(declaration({ floor: 0, floorKind: 'pilotis' }), null)?.floor).toEqual({
      number: 0,
      kind: 'pilotis',
    });
  });

  it('🔴 ΚΑΕΚ ΜΟΝΟ από `verified` — ποτέ από εκκρεμή/απορριφθείσα απόδειξη', () => {
    expect(composePlaceUnitRef(declaration(), { status: 'verified', kaek: UNIT_KAEK })?.kaek).toBe(UNIT_KAEK);
    for (const status of OWNERSHIP_VERIFICATION_STATUSES.filter((s) => s !== 'verified')) {
      expect(composePlaceUnitRef(declaration(), { status, kaek: UNIT_KAEK })?.kaek).toBeNull();
    }
  });

  it('🔴 ΚΑΕΚ γεωτεμαχίου (χωρίς /Κ/Ο) δεν είναι μονάδα', () => {
    expect(unitKaekOf({ status: 'verified', kaek: '050681726003' })).toBeNull();
    expect(unitKaekOf({ status: 'verified', kaek: 'σκουπίδι' })).toBeNull();
  });
});

describe('placeUnitKey', () => {
  it('ο ΚΑΕΚ κερδίζει — ισχυρό, κτηματολογικό κλειδί', () => {
    expect(placeUnitKey(unit({ kaek: UNIT_KAEK }))).toEqual({ strength: 'cadastral', key: `kaek:${UNIT_KAEK}` });
  });

  it('🔑 ελληνικό «Α1» ≡ λατινικό «A1» στο ίδιο κτίριο και στάθμη (σκελετός UTS #39)', () => {
    expect(placeUnitKey(unit({ unitNumber: 'Α1' }))).toEqual(placeUnitKey(unit({ unitNumber: 'A1' })));
    expect(placeUnitKey(unit())?.strength).toBe('declared');
  });

  it('άλλη στάθμη ή άλλη πόρτα ⇒ άλλη μονάδα (πυλωτή ≠ ισόγειο)', () => {
    const base = placeUnitKey(unit({ floor: { number: 0, kind: 'ground' } }));
    expect(placeUnitKey(unit({ floor: { number: 0, kind: 'pilotis' } }))).not.toEqual(base);
    expect(placeUnitKey(unit({ unitNumber: 'Β1' }))).not.toEqual(placeUnitKey(unit()));
  });

  it('ελλιπής μονάδα χωρίς ΚΑΕΚ ⇒ null (καμία ψευδο-μονάδα)', () => {
    expect(placeUnitKey(unit({ buildingId: null }))).toBeNull();
    expect(placeUnitKey(unit({ floor: null }))).toBeNull();
    expect(placeUnitKey(unit({ unitNumber: null }))).toBeNull();
  });
});
