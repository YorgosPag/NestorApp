/**
 * @fileoverview 📍 **ΟΙ ΠΡΑΞΕΙΣ ΤΟΥ ΕΠΕΞΕΡΓΑΣΤΗ** — τοποθέτηση, στόχευση, πεδίο, ομάδες (ADR-897 Φ3).
 * @related lib/listings/photo-capture-spot-edit · lib/geometry/view-cone
 *
 * 🔴 Η κρίσιμη ερώτηση: *«υπολογίζεται η γωνία σε PIXEL;»* — σε κάτοψη 2:1, ο στόχος στο `(+0,1; −0,1)` κανονικοποιημένο
 * είναι **63,4°**, όχι 45°. Ένας επεξεργαστής που μετρούσε σε κλάσματα θα έδειχνε στον επισκέπτη άλλη κατεύθυνση από
 * αυτήν που έσυρε ο άνθρωπος.
 */

import { degToRad } from '@/lib/geometry/angle';
import { conePath, headingTowards, pointAlongHeading } from '@/lib/geometry/view-cone';
import { MAX_PHOTO_FOV_RAD, MIN_PHOTO_FOV_RAD, readPhotoCaptureSpot, type PhotoCaptureSpot } from '@/lib/listings/photo-capture-spot';
import {
  aimSpot,
  groupCaptureSpots,
  nudgeSpot,
  placeSpot,
  resizeSpotFov,
  rotateSpot,
  widenSpot,
} from '@/lib/listings/photo-capture-spot-edit';

const WIDE = { width: 2000, height: 1000 };
const SPOT: PhotoCaptureSpot = { floorplanFileId: 'plan', x: 0.5, y: 0.5, headingRad: 0, fovRad: 1 };

describe('view-cone — 0 = πάνω, δεξιόστροφα', () => {
  it.each([
    [{ x: 0, y: -1 }, 0],
    [{ x: 1, y: 0 }, Math.PI / 2],
    [{ x: 0, y: 1 }, Math.PI],
    [{ x: -1, y: 0 }, (3 * Math.PI) / 2],
  ])('προς %p ⇒ %p', (target, expected) => {
    expect(headingTowards({ x: 0, y: 0 }, target)).toBeCloseTo(expected);
  });

  it('pointAlongHeading είναι το αντίστροφο του headingTowards', () => {
    const tip = pointAlongHeading({ x: 10, y: 10 }, 1.1, 5);
    expect(headingTowards({ x: 10, y: 10 }, tip)).toBeCloseTo(1.1);
  });

  it('ο κώνος ανοίγει προς τα πάνω (αρνητικό y)', () => {
    expect(conePath(Math.PI / 4, 10)).toMatch(/^M 0 0 L -7\.07\d* -7\.07/u);
  });
});

describe('placeSpot — μετακίνηση δεν είναι επαναπροσανατολισμός', () => {
  it('νέα φωτογραφία ⇒ προς τα πάνω, με το πεδίο που δόθηκε', () => {
    expect(placeSpot(null, 'plan', { x: 0.12345, y: 1.4 }, 1.3)).toEqual(
      { floorplanFileId: 'plan', x: 0.123, y: 1, headingRad: 0, fovRad: 1.3 },
    );
  });

  it('υπάρχουσα ⇒ κρατά κατεύθυνση και πεδίο, αλλάζει όροφο/θέση', () => {
    const moved = placeSpot({ ...SPOT, headingRad: 2, fovRad: 0.7 }, 'upstairs', { x: 0.2, y: 0.3 });
    expect(moved).toEqual({ floorplanFileId: 'upstairs', x: 0.2, y: 0.3, headingRad: 2, fovRad: 0.7 });
  });
});

describe('aimSpot — η γωνία μετριέται σε PIXEL', () => {
  it('σε κάτοψη 2:1, το (+0,1; −0,1) είναι 63,4° και όχι 45°', () => {
    const aimed = aimSpot(SPOT, { x: 0.6, y: 0.4 }, WIDE);
    expect(aimed.headingRad).toBeCloseTo(Math.atan2(200, 100));
  });

  it('στόχος πάνω στο σημείο ⇒ καμία αλλαγή', () => {
    expect(aimSpot(SPOT, { x: 0.5, y: 0.5 }, WIDE)).toBe(SPOT);
  });
});

describe('widenSpot — διπλάσιο της γωνίας από την κατεύθυνση, σφηνωμένο', () => {
  it('άκρη στις 30° δεξιά ⇒ πεδίο 60°', () => {
    const edge = pointAlongHeading({ x: 1000, y: 500 }, degToRad(30), 100);
    expect(widenSpot(SPOT, { x: edge.x / 2000, y: edge.y / 1000 }, WIDE).fovRad).toBeCloseTo(degToRad(60));
  });

  it('η αριστερή άκρη δίνει το ίδιο (συμμετρικό)', () => {
    const edge = pointAlongHeading({ x: 1000, y: 500 }, degToRad(-30), 100);
    expect(widenSpot(SPOT, { x: edge.x / 2000, y: edge.y / 1000 }, WIDE).fovRad).toBeCloseTo(degToRad(60));
  });

  it('πίσω από την κάμερα ⇒ σφήνωμα στο μέγιστο, ποτέ πεδίο που η πόρτα αρνείται', () => {
    const widened = widenSpot(SPOT, { x: 0.5, y: 0.9 }, WIDE);
    expect(widened.fovRad).toBe(MAX_PHOTO_FOV_RAD);
    expect(readPhotoCaptureSpot(widened)).not.toBeNull();
  });
});

describe('πληκτρολόγιο — όρια και κανονικοποίηση', () => {
  it('nudge σφηνώνει στην εικόνα', () => {
    expect(nudgeSpot({ ...SPOT, x: 0.99 }, 0.05, 0)).toMatchObject({ x: 1, y: 0.5 });
  });

  it('rotate τυλίγεται στο [0, 2π)', () => {
    expect(rotateSpot(SPOT, -degToRad(15)).headingRad).toBeCloseTo(degToRad(345));
  });

  it('resize σφηνώνει στο ελάχιστο', () => {
    expect(resizeSpotFov(SPOT, -10).fovRad).toBe(MIN_PHOTO_FOV_RAD);
  });
});

describe('groupCaptureSpots — οι τέσσερις ομάδες, με τη σειρά της αγγελίας', () => {
  it('χωρίς θέση · εδώ · αλλού · ορφανό', () => {
    const spots = new Map([
      ['b', { ...SPOT, floorplanFileId: 'ground' }],
      ['c', { ...SPOT, floorplanFileId: 'first' }],
      ['d', { ...SPOT, floorplanFileId: 'withdrawn' }],
      ['e', { ...SPOT, floorplanFileId: 'ground' }],
    ]);
    expect(groupCaptureSpots(['a', 'b', 'c', 'd', 'e'], spots, ['ground', 'first'], 'ground')).toEqual({
      unplaced: ['a'], here: ['b', 'e'], elsewhere: ['c'], orphaned: ['d'],
    });
  });
});
