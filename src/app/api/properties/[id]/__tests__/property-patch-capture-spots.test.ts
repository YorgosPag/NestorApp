/**
 * @jest-environment node
 *
 * @fileoverview 📍 **Η ΠΟΡΤΑ ΤΩΝ ΣΗΜΕΙΩΝ ΛΗΨΗΣ ΤΟΥ ΓΡΑΦΕΙΟΥ** (ADR-897).
 * @related property-patch-helpers.ts · lib/listings/photo-capture-spot
 *
 * 🔴 Το `PropertyPatchSchema` είναι `.passthrough()`: χωρίς ρητή γραμμή, **οποιοδήποτε** σχήμα θα
 * γραφόταν αυτούσιο. ⛔ **ΜΕΤΑΛΛΑΞΗ**: βγάλε το `publishedPhotoCaptureSpots` από το σχήμα ⇒ τα Π2 κοκκινίζουν.
 */

import { DEFAULT_PHOTO_FOV_RAD } from '@/lib/listings/photo-capture-spot';
import { PUBLISHED_MEDIA_LIMIT } from '@/services/upload/utils/storage-path-public-shelf';

import { PropertyPatchSchema } from '../property-patch-helpers';

const parse = (value: unknown) => PropertyPatchSchema.safeParse({ publishedPhotoCaptureSpots: value });
const SPOT = { floorplanFileId: 'plan_1', x: 0.4, y: 0.6, headingRad: 1.5, fovRad: DEFAULT_PHOTO_FOV_RAD };

describe('Π1 — έγκυρη δήλωση περνά', () => {
  it('σημεία ανά φωτογραφία', () => {
    expect(parse({ photo_a: SPOT, photo_b: { ...SPOT, x: 0, y: 1 } }).success).toBe(true);
  });

  it('κενός χάρτης — η απόσυρση του τελευταίου σημείου', () => {
    expect(parse({}).success).toBe(true);
  });
});

describe('Π2 — σκουπίδι ΑΠΟΡΡΙΠΤΕΤΑΙ, ποτέ δεν σφηνώνεται σιωπηλά', () => {
  it.each([
    ['θέση εκτός κάτοψης', { photo_a: { ...SPOT, x: 1.2 } }],
    ['χωρίς κάτοψη', { photo_a: { ...SPOT, floorplanFileId: '' } }],
    ['πεδίο 360° (είναι το spatial-tour)', { photo_a: { ...SPOT, fovRad: 2 * Math.PI } }],
    ['λείπει κατεύθυνση', { photo_a: { floorplanFileId: 'p', x: 0.5, y: 0.5, fovRad: 1 } }],
    ['επιπλέον πεδίο', { photo_a: { ...SPOT, zoom: 2 } }],
    ['πίνακας', [SPOT]],
  ])('🔴 %s ⇒ ΑΠΟΡΡΙΨΗ', (_label, value) => {
    expect(parse(value).success).toBe(false);
  });
});

describe('Π3 — το όριο είναι το ΥΠΑΡΧΟΝ', () => {
  const spots = (count: number) =>
    Object.fromEntries(Array.from({ length: count }, (_, i) => [`photo_${i}`, SPOT]));

  it('ακριβώς στο `PUBLISHED_MEDIA_LIMIT` περνά· ένα πάνω απορρίπτεται', () => {
    expect(parse(spots(PUBLISHED_MEDIA_LIMIT)).success).toBe(true);
    expect(parse(spots(PUBLISHED_MEDIA_LIMIT + 1)).success).toBe(false);
  });
});
