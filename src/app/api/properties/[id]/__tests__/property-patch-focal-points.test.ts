/**
 * @jest-environment node
 *
 * @fileoverview 🎯 **Η ΠΟΡΤΑ ΤΩΝ ΣΗΜΕΙΩΝ ΕΣΤΙΑΣΗΣ ΤΟΥ ΓΡΑΦΕΙΟΥ** (ADR-880).
 * @related property-patch-helpers.ts · lib/listings/photo-focal-point
 *
 * 🔴 Το `PropertyPatchSchema` είναι `.passthrough()`: χωρίς ρητή γραμμή, **οποιοδήποτε** σχήμα θα
 * γραφόταν αυτούσιο. ⛔ **ΜΕΤΑΛΛΑΞΗ**: βγάλε το `publishedMediaFocalPoints` από το σχήμα ⇒ τα Π2 κοκκινίζουν.
 */

import { PUBLISHED_MEDIA_LIMIT } from '@/services/upload/utils/storage-path-public-shelf';

import { PropertyPatchSchema } from '../property-patch-helpers';

const parse = (value: unknown) => PropertyPatchSchema.safeParse({ publishedMediaFocalPoints: value });

describe('Π1 — έγκυρη δήλωση περνά', () => {
  it('σημεία ανά ταυτότητα αρχείου', () => {
    expect(parse({ file_a: { x: 0, y: 1 }, file_b: { x: 0.5, y: 0.25 } }).success).toBe(true);
  });

  it('κενός χάρτης — η απόσυρση του τελευταίου σημείου', () => {
    expect(parse({}).success).toBe(true);
  });
});

describe('Π2 — σκουπίδι ΑΠΟΡΡΙΠΤΕΤΑΙ, ποτέ δεν σφηνώνεται σιωπηλά', () => {
  it.each([
    ['σημείο εκτός εικόνας', { file_a: { x: 1.2, y: 0.5 } }],
    ['αρνητικό', { file_a: { x: -0.1, y: 0.5 } }],
    ['λείπει άξονας', { file_a: { x: 0.5 } }],
    ['επιπλέον πεδίο', { file_a: { x: 0.5, y: 0.5, zoom: 2 } }],
    ['πίνακας', [{ x: 0.5, y: 0.5 }]],
    ['συμβολοσειρά', '0.5,0.5'],
  ])('🔴 %s ⇒ ΑΠΟΡΡΙΨΗ', (_label, value) => {
    expect(parse(value).success).toBe(false);
  });
});

describe('Π3 — το όριο είναι το ΥΠΑΡΧΟΝ', () => {
  const points = (count: number) =>
    Object.fromEntries(Array.from({ length: count }, (_, i) => [`file_${i}`, { x: 0.5, y: 0.5 }]));

  it('ακριβώς στο `PUBLISHED_MEDIA_LIMIT` περνά· ένα πάνω απορρίπτεται', () => {
    expect(parse(points(PUBLISHED_MEDIA_LIMIT)).success).toBe(true);
    expect(parse(points(PUBLISHED_MEDIA_LIMIT + 1)).success).toBe(false);
  });
});
