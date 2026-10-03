/**
 * ⚓ ADR-900 §8 #2 (2β.2) · **απόφαση Giorgio Ε2** — η δημόσια αγγελία δείχνει **όροφο με είδος**, ΟΧΙ πόρτα, ΟΧΙ ΚΑΕΚ.
 *
 * 🔑 Σαρώνει το **σειριοποιημένο** αποτέλεσμα, όχι ένα πεδίο: ένα μελλοντικό πεδίο που θα αντέγραφε την πόρτα με
 * άλλο όνομα (`unitLabel`, `door`, μέσα σε `title`…) κοκκινίζει εδώ, χωρίς να το ξέρει κανείς από πριν.
 */

import { placeKnowledgeFromOwnerProperty, projectableFromOwnerProperty } from '../owner-property-projection';
import { buildPublicListing } from '@/services/listings/public-listing-projection';
import { composePlaceUnitRef } from '@/lib/geo/place-unit';
import { validOwnerProperty } from './owner-property-fixtures';

const AT = '2026-10-03T12:00:00.000Z';
/** Αριθμός μονάδας που δεν εμφανίζεται πουθενά αλλού στο fixture. */
const UNIT = 'ΖΩ917';
const UNIT_KAEK = '050681726003/0/1';

const property = validOwnerProperty({
  floor: 0,
  floorKind: 'pilotis',
  unitNumber: UNIT,
  place: {
    kind: 'declared',
    point: { lat: 40.63, lng: 22.95 },
    label: 'Εγνατίας 147, Θεσσαλονίκη',
    accuracy: 'exact',
    link: { landId: 'land_1', buildingId: 'pbld_1' },
  },
});

function publish(over: Partial<ReturnType<typeof projectableFromOwnerProperty>> = {}) {
  return buildPublicListing(
    { ...projectableFromOwnerProperty(property, AT), ...over },
    placeKnowledgeFromOwnerProperty(property, AT),
    AT,
  );
}

describe('🔒 Ε2 — η αγγελία δεν διαρρέει τη μονάδα', () => {
  it('η μονάδα υπάρχει στον κάτοχο (πόρτα + επαληθευμένος ΚΑΕΚ)…', () => {
    const unit = composePlaceUnitRef(property, { status: 'verified', kaek: UNIT_KAEK });
    expect([unit?.unitNumber, unit?.kaek]).toEqual([UNIT, UNIT_KAEK]);
  });

  it('…αλλά η σειριοποιημένη αγγελία δεν περιέχει ούτε την πόρτα ούτε ΚΑΕΚ', () => {
    const listing = publish();
    expect(listing).not.toBeNull();
    const json = JSON.stringify(listing);
    expect(json).not.toContain(UNIT);
    expect(json).not.toContain(UNIT_KAEK);
    expect(json).not.toMatch(/"(unitNumber|kaek|door)"/);
  });

  it('🏢 ο όροφος φεύγει ΜΕ το είδος: πυλωτή, όχι «ισόγειο»', () => {
    expect([publish()?.floor, publish()?.floorKind]).toEqual([0, 'pilotis']);
  });

  it('εταιρικό ακίνητο (ίδια κοινή προβολή): το `floorKind` του αντιγράφου HostedOnFloor δεν χάνεται', () => {
    expect(publish({ floor: 2, floorKind: 'mezzanine' })?.floorKind).toBe('mezzanine');
    expect(publish({ floor: 2, floorKind: undefined })?.floorKind).toBeNull();
  });

  it('είδος χωρίς αριθμό δεν δημοσιεύεται ως ορφανό είδος', () => {
    expect([publish({ floor: null, floorKind: 'roof' })?.floor, publish({ floor: null, floorKind: 'roof' })?.floorKind])
      .toEqual([null, null]);
  });
});
