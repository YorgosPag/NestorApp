/**
 * Άγκυρες του γραφέα του `floorPlates[]` (ADR-907 §11.5 · CHECK 3.76). Οι τίτλοι των `describe` είναι **δηλωμένοι** στο
 * `scripts/lib/listing-model-custody/contract.js` — μετονομασία εδώ χωρίς αλλαγή εκεί κοκκινίζει την πύλη, επίτηδες.
 *
 * Πρόθεμα **ΚΟ** (κάτοψη ορόφου): τα Σ, Κ, Λ, Φ, Β, Π είναι ήδη πιασμένα από γειτονικές σουίτες.
 */

import elListingDetail from '@/i18n/locales/el/listing-detail.json';
import enListingDetail from '@/i18n/locales/en/listing-detail.json';
import { LISTING_FLOOR_PLATE_ALT_KEY } from '@/lib/listings/floor-plate/floor-plate-keys';
import {
  LISTING_FLOOR_PLATE_MAX_COUNT,
  isPublishableFloorPlateUnits,
} from '@/lib/listings/floor-plate/floor-plate-publication';
import type { ListingMaterial } from '@/lib/listings/listing-material';
import type { FloorPlateUnit, PublicListing } from '@/types/public-listing';

import {
  splitFloorPlateImages,
  withPublishedFloorPlates,
  withinFloorPlateAdmission,
  type ProjectedShelfFloorPlate,
} from '../public-listing-floor-plate-projection';

const AT = '2026-10-10T09:00:00.000Z';

/** Τρίγωνο μέσα στην εικόνα — το μικρότερο νόμιμο περίγραμμα. */
const TRIANGLE = [0.1, 0.1, 0.9, 0.1, 0.5, 0.9] as const;

const SELF: FloorPlateUnit = { outline: TRIANGLE, state: 'self' };
const NEIGHBOUR: FloorPlateUnit = { outline: [0.2, 0.2, 0.4, 0.2, 0.4, 0.4, 0.2, 0.4], state: 'reserved' };
const LINKED: FloorPlateUnit = { outline: TRIANGLE, state: 'available', listingId: 'prop_public' };

const IMAGE: ProjectedShelfFloorPlate['image'] = {
  url: 'https://storage.googleapis.com/public-media/listings/prop_1/' + 'f'.repeat(64) + '.webp',
  width: 2560,
  height: 1829,
  sources: [{ url: 'https://shelf/floor-1280.webp', width: 1280 }],
};

const PLATE: ProjectedShelfFloorPlate = { image: IMAGE, at: AT, provenance: 'measured', units: [SELF, NEIGHBOUR] };

/** Μόνο ό,τι διαβάζει ο γραφέας — ο πλήρης τύπος έχει δεκάδες πεδία που δεν τον αφορούν. */
function listing(): PublicListing {
  const partial: Pick<PublicListing, 'authorship' | 'floorPlates'> = { authorship: 'agency', floorPlates: [] };
  return partial as PublicListing;
}

function floorPlate(units: readonly FloorPlateUnit[]): ListingMaterial {
  return { kind: 'floorPlate', at: AT, provenance: 'declared', units };
}

function carrying(material: ListingMaterial, tag: string): { readonly material: ListingMaterial; readonly tag: string } {
  return { material, tag };
}

describe('ΚΟ-1 — ΤΟ `floorPlates[]` ΧΤΙΖΕΤΑΙ ΑΠΟ ΤΗΝ ΑΝΑΦΟΡΑ ΤΟΥ ΡΑΦΙΟΥ', () => {
  it('η όψη της εικόνας φτάνει όπως την έβγαλε το ράφι, με το κλειδί της κάτοψης ορόφου', () => {
    const [plate] = withPublishedFloorPlates(listing(), [PLATE]).floorPlates;

    expect(plate.value.image).toEqual({ ...IMAGE, altKey: LISTING_FLOOR_PLATE_ALT_KEY });
  });

  it.each(['measured', 'declared'] as const)('🔑 η προέλευση «%s» και η στιγμή είναι ΤΗΣ ΠΗΓΗΣ — δεν καρφώνονται', (provenance) => {
    const [plate] = withPublishedFloorPlates(listing(), [{ ...PLATE, provenance }]).floorPlates;

    expect(plate.provenance).toBe(provenance);
    expect(plate.at).toBe(AT);
  });

  it('κενή αναφορά ⇒ κενό κουτί — ό,τι είχε η αγγελία πριν ΔΕΝ επιβιώνει', () => {
    const published = withPublishedFloorPlates(listing(), [PLATE]);

    expect(withPublishedFloorPlates(published, []).floorPlates).toEqual([]);
  });

  it('🔴 πάνω από το όριο ⇒ άρνηση με όνομα, ποτέ δεύτερος όροφος σιωπηλά', () => {
    const tooMany = Array.from({ length: LISTING_FLOOR_PLATE_MAX_COUNT + 1 }, () => PLATE);

    expect(() => withPublishedFloorPlates(listing(), tooMany)).toThrow(/withinFloorPlateAdmission/);
  });

  it('το κλειδί υπάρχει και στις δύο γλώσσες — αλλιώς ο επισκέπτης βλέπει ωμό κλειδί', () => {
    expect(LISTING_FLOOR_PLATE_ALT_KEY).toBe('listing-detail:floorPlate.alt');
    expect(typeof elListingDetail.floorPlate.alt).toBe('string');
    expect(typeof enListingDetail.floorPlate.alt).toBe('string');
  });
});

describe('ΚΟ-2 — ΜΟΝΟ ΣΧΗΜΑ, ΚΑΤΑΣΤΑΣΗ ΚΑΙ ΔΗΜΟΣΙΟΣ ΣΥΝΔΕΣΜΟΣ ΦΤΑΝΟΥΝ ΣΤΟ ΕΓΓΡΑΦΟ', () => {
  it('🔴 ό,τι άλλο κουβαλά μια μονάδα (ταυτότητα, τιμή, όνομα) ΔΕΝ γράφεται', () => {
    // Χωρίς cast: αντικείμενο με περισσότερα πεδία είναι νόμιμη τιμή του τύπου — ακριβώς έτσι θα ξέφευγε.
    const leaky = { ...NEIGHBOUR, propertyId: 'prop_secret', askingPrice: 250000, name: 'Διαμέρισμα Β2' };
    const unit: FloorPlateUnit = leaky;

    const published = withPublishedFloorPlates(listing(), [{ ...PLATE, units: [SELF, unit] }]);
    const written = published.floorPlates[0].value.units[1];

    expect(Object.keys(written).sort()).toEqual(['outline', 'state']);
    expect(JSON.stringify(published.floorPlates)).not.toMatch(/prop_secret|250000|Β2/);
  });

  it('ο σύνδεσμος γράφεται ΜΟΝΟ όταν υπάρχει — ποτέ πεδίο `undefined` (το Firestore το αρνείται)', () => {
    const { units } = withPublishedFloorPlates(listing(), [{ ...PLATE, units: [SELF, LINKED] }]).floorPlates[0].value;

    expect('listingId' in units[0]).toBe(false);
    expect(units[1].listingId).toBe('prop_public');
  });

  it('σχήμα και κατάσταση φτάνουν αυτούσια, με τη σειρά της πηγής', () => {
    const { units } = withPublishedFloorPlates(listing(), [PLATE]).floorPlates[0].value;

    expect(units).toEqual([SELF, NEIGHBOUR]);
  });
});

describe('ΚΟ-3 — Η ΑΡΝΗΣΗ ΓΙΝΕΤΑΙ ΠΡΙΝ ΑΠΟ ΤΟ ΡΑΦΙ', () => {
  it('νόμιμη κάτοψη ορόφου περνά· κάθε άλλο υλικό περνά αυτούσιο, στη σειρά του', () => {
    const sources = [
      carrying({ kind: 'photo' }, 'a'),
      carrying(floorPlate([SELF, NEIGHBOUR]), 'floor'),
      carrying({ kind: 'floorplan', at: AT, provenance: 'declared' }, 'plan'),
    ];

    expect(withinFloorPlateAdmission(sources).map((s) => s.tag)).toEqual(['a', 'floor', 'plan']);
  });

  it.each([
    ['καμία μονάδα «αυτό το ακίνητο»', [NEIGHBOUR]],
    ['δύο μονάδες «αυτό το ακίνητο»', [SELF, SELF]],
    ['κενός όροφος', []],
    ['περίγραμμα με μονό πλήθος αριθμών', [SELF, { outline: [0.1, 0.1, 0.9, 0.1, 0.5], state: 'reserved' }]],
    ['κορυφή έξω από την εικόνα', [SELF, { outline: [0.1, 0.1, 1.2, 0.1, 0.5, 0.9], state: 'reserved' }]],
    ['δύο μόνο κορυφές', [SELF, { outline: [0.1, 0.1, 0.9, 0.9], state: 'reserved' }]],
  ] as const)('🔴 %s ⇒ ολόκληρη η κάτοψη μένει έξω από το ράφι', (_why, units) => {
    const sources = [carrying({ kind: 'photo' }, 'a'), carrying(floorPlate(units), 'floor')];

    expect(withinFloorPlateAdmission(sources).map((s) => s.tag)).toEqual(['a']);
  });

  it.each([
    ['άγνωστη κατάσταση', { outline: TRIANGLE, state: 'sold' }],
    ['κενός σύνδεσμος', { outline: TRIANGLE, state: 'available', listingId: '' }],
    ['σύνδεσμος που δεν είναι κείμενο', { outline: TRIANGLE, state: 'available', listingId: 7 }],
    ['μονάδα που δεν είναι αντικείμενο', null],
  ])('🔴 %s ⇒ οι μονάδες δεν δημοσιεύονται (όλες ή καμία)', (_why, broken) => {
    expect(isPublishableFloorPlateUnits([SELF, broken])).toBe(false);
    expect(isPublishableFloorPlateUnits([SELF, NEIGHBOUR, LINKED])).toBe(true);
  });

  it('🔴 δεύτερη κάτοψη ορόφου κόβεται — μένει η πρώτη στη σειρά', () => {
    const sources = [carrying(floorPlate([SELF]), 'first'), carrying(floorPlate([SELF, NEIGHBOUR]), 'second')];

    expect(withinFloorPlateAdmission(sources).map((s) => s.tag)).toEqual(['first']);
  });

  it('άκυρη κάτοψη ΔΕΝ τρώει τη θέση της νόμιμης που ακολουθεί', () => {
    const sources = [carrying(floorPlate([NEIGHBOUR]), 'broken'), carrying(floorPlate([SELF]), 'valid')];

    expect(withinFloorPlateAdmission(sources).map((s) => s.tag)).toEqual(['valid']);
  });
});

describe('ο διαχωρισμός της αναφοράς του raster ραφιού', () => {
  it('ΕΝΑ πέρασμα: κάθε εικόνα σε ακριβώς ένα από τα δύο, με τη σειρά της', () => {
    const images = [
      carrying({ kind: 'photo' }, 'a'),
      carrying(floorPlate([SELF]), 'floor'),
      carrying({ kind: 'video' }, 'poster'),
    ];
    const { floorPlates, rest } = splitFloorPlateImages(images);

    expect(floorPlates.map((plate) => plate.image.tag)).toEqual(['floor']);
    expect(rest.map((image) => image.tag)).toEqual(['a', 'poster']);
    expect(floorPlates.length + rest.length).toBe(images.length);
  });

  it('το υλικό βγαίνει ήδη στενεμένο — οι μονάδες διαβάζονται χωρίς δεύτερο έλεγχο είδους', () => {
    const [plate] = splitFloorPlateImages([carrying(floorPlate([SELF, LINKED]), 'floor')]).floorPlates;

    expect(plate.material.units).toEqual([SELF, LINKED]);
  });
});
