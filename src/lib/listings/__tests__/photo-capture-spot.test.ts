/**
 * @fileoverview **ΤΟ ΣΗΜΕΙΟ ΛΗΨΗΣ — ανάγνωση, δημόσια μορφή, οπτικό πεδίο** (ADR-897).
 * @related lib/listings/photo-capture-spot
 *
 * Τέσσερις ερωτήσεις: *«διαβάζεται σκουπίδι ως απουσία;»* · *«πέφτει το σημείο όταν η κάτοψή του
 * δεν δημοσιεύτηκε;»* · *«βγαίνει σωστό το πεδίο από το EXIF — και στην όρθια φωτογραφία;»* ·
 * *«αφαιρεί το `null` τη γραμμή;»*.
 */

import { degToRad } from '@/lib/geometry/angle';
import {
  DEFAULT_PHOTO_FOV_RAD,
  MAX_PHOTO_FOV_RAD,
  MIN_PHOTO_FOV_RAD,
  declaredCaptureSpotsSchema,
  horizontalFovFromExif,
  readDeclaredCaptureSpots,
  readListingCaptureSpot,
  readPhotoCaptureSpot,
  sameDeclaredCaptureSpots,
  toListingCaptureSpot,
  withDeclaredCaptureSpot,
  type PhotoCaptureSpot,
} from '@/lib/listings/photo-capture-spot';

const SPOT: PhotoCaptureSpot = { floorplanFileId: 'plan-1', x: 0.25, y: 0.75, headingRad: 1, fovRad: 1.2 };

describe('readPhotoCaptureSpot — σκουπίδι ⇒ απουσία', () => {
  it('έγκυρο σημείο περνά αυτούσιο', () => {
    expect(readPhotoCaptureSpot(SPOT)).toEqual(SPOT);
  });

  it('αρνητική κατεύθυνση κανονικοποιείται — ίδια δήλωση, όχι απώλεια', () => {
    const spot = readPhotoCaptureSpot({ ...SPOT, headingRad: -Math.PI / 2 });
    expect(spot?.headingRad).toBeCloseTo((3 * Math.PI) / 2);
  });

  it.each([
    undefined,
    null,
    [],
    'x',
    { ...SPOT, floorplanFileId: '' },
    { ...SPOT, floorplanFileId: '   ' },
    { ...SPOT, x: -0.01 },
    { ...SPOT, y: 1.01 },
    { ...SPOT, headingRad: Number.NaN },
    { ...SPOT, fovRad: MIN_PHOTO_FOV_RAD / 2 },
    { ...SPOT, fovRad: MAX_PHOTO_FOV_RAD * 2 },
    { ...SPOT, extra: true },
  ])('%p ⇒ null', (value) => {
    expect(readPhotoCaptureSpot(value)).toBeNull();
  });
});

describe('readDeclaredCaptureSpots — άκυρη γραμμή πέφτει μόνη της', () => {
  it('κρατά τις έγκυρες, πετά τις άκυρες', () => {
    const map = readDeclaredCaptureSpots({ a: SPOT, b: { x: 2 }, ' ': SPOT });
    expect([...map.keys()]).toEqual(['a']);
  });

  it.each([null, [], 'x', 3])('%p ⇒ κενός χάρτης', (value) => {
    expect(readDeclaredCaptureSpots(value).size).toBe(0);
  });
});

describe('withDeclaredCaptureSpot / sameDeclaredCaptureSpots', () => {
  it('το `null` αφαιρεί τη γραμμή — ποτέ μετάλλαξη του αρχικού', () => {
    const before = new Map([['a', SPOT]]);
    const after = withDeclaredCaptureSpot(before, 'a', null);
    expect(after.size).toBe(0);
    expect(before.size).toBe(1);
  });

  it('ίδιο περιεχόμενο σε άλλη σειρά ⇒ ίσα· άλλη κατεύθυνση ⇒ άνισα', () => {
    const a = new Map([['a', SPOT], ['b', SPOT]]);
    const b = new Map([['b', SPOT], ['a', SPOT]]);
    expect(sameDeclaredCaptureSpots(a, b)).toBe(true);
    expect(sameDeclaredCaptureSpots(a, withDeclaredCaptureSpot(b, 'a', { ...SPOT, headingRad: 2 }))).toBe(false);
  });
});

describe('toListingCaptureSpot — καμία ταυτότητα αρχείου στο κοινό, κανένας κρεμασμένος δείκτης', () => {
  it('ταυτότητα κάτοψης ⇒ δείκτης', () => {
    const spot = toListingCaptureSpot(SPOT, new Map([['plan-1', 2]]));
    expect(spot).toEqual({ floorplanIndex: 2, x: 0.25, y: 0.75, headingRad: 1, fovRad: 1.2 });
    expect(JSON.stringify(spot)).not.toContain('plan-1');
  });

  it('κάτοψη που δεν δημοσιεύτηκε ⇒ το σημείο πέφτει', () => {
    expect(toListingCaptureSpot(SPOT, new Map([['plan-2', 0]]))).toBeNull();
    expect(toListingCaptureSpot(null, new Map([['plan-1', 0]]))).toBeNull();
  });
});

describe('readListingCaptureSpot — ο αναγνώστης δεν δανείζεται την εμπιστοσύνη του γραφέα', () => {
  const PUBLIC = { floorplanIndex: 1, x: 0.5, y: 0.5, headingRad: 0, fovRad: 1 };

  it('έγκυρο σημείο σε υπάρχουσα κάτοψη περνά', () => {
    expect(readListingCaptureSpot(PUBLIC, 2)).toEqual(PUBLIC);
  });

  it.each([
    ['δείκτης πέρα από τις κατόψεις', PUBLIC, 1],
    ['καμία κάτοψη', PUBLIC, 0],
    ['μη ακέραιος δείκτης', { ...PUBLIC, floorplanIndex: 0.5 }, 2],
    ['διαρροή ταυτότητας αρχείου', { ...PUBLIC, floorplanFileId: 'x' }, 2],
    ['απόν', undefined, 2],
  ])('%s ⇒ null', (_label, value, count) => {
    expect(readListingCaptureSpot(value, count)).toBeNull();
  });
});

describe('horizontalFovFromExif — 2·atan(διάσταση / 2f)', () => {
  it('26 mm οριζόντια ⇒ ≈ 69,4°', () => {
    expect(horizontalFovFromExif(26, false)).toBeCloseTo(degToRad(69.39), 3);
  });

  it('όρθια φωτογραφία ⇒ στενότερο πεδίο (24 mm πλευρά)', () => {
    expect(horizontalFovFromExif(26, true)).toBeCloseTo(2 * Math.atan(24 / 52), 6);
  });

  it('σφηνώνει στα όρια', () => {
    expect(horizontalFovFromExif(1, false)).toBe(MAX_PHOTO_FOV_RAD);
    expect(horizontalFovFromExif(10_000, false)).toBe(MIN_PHOTO_FOV_RAD);
  });

  it.each([undefined, null, 0, -5, Number.NaN, '26'])('%p ⇒ null («δεν ξέρουμε»), όχι προεπιλογή', (value) => {
    expect(horizontalFovFromExif(value, false)).toBeNull();
  });

  it('η προεπιλογή είναι ο κύριος φακός κινητού και περνά την πόρτα', () => {
    expect(DEFAULT_PHOTO_FOV_RAD).toBeCloseTo(degToRad(69.39), 3);
    expect(readPhotoCaptureSpot({ ...SPOT, fovRad: DEFAULT_PHOTO_FOV_RAD })).not.toBeNull();
  });
});

describe('declaredCaptureSpotsSchema — η πόρτα', () => {
  it('δέχεται τον κενό χάρτη (απόσυρση όλων)', () => {
    expect(declaredCaptureSpotsSchema(2).safeParse({}).success).toBe(true);
  });

  it('αρνείται πάνω από το όριο και σκουπίδι', () => {
    expect(declaredCaptureSpotsSchema(1).safeParse({ a: SPOT, b: SPOT }).success).toBe(false);
    expect(declaredCaptureSpotsSchema(2).safeParse({ a: { ...SPOT, x: 9 } }).success).toBe(false);
  });
});
